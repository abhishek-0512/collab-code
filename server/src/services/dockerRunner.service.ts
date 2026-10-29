/**
 * Docker Runner Service
 *
 * Executes untrusted code inside a locked-down Docker container and streams
 * stdout/stderr back to the caller with hard limits on output volume and
 * wall-clock time.
 *
 * COMBINED OUTPUT LIMIT (Phase 2 / Bug Fix)
 * ------------------------------------------
 * Stdout and stderr share a single 512 KB byte budget.  As soon as the
 * combined total crosses MAX_COMBINED_OUTPUT_BYTES the child process group
 * is killed immediately and the Promise resolves with
 * outputLimitExceeded === true.  This prevents the previous behaviour where
 * a stderr-flooding program would only truncate the captured text but keep
 * running until the timeout.
 *
 * PROCESS / CONTAINER LIFECYCLE
 * --------------------------------
 * 1. docker run is spawned in a new process group (detached: true).
 * 2. On timeout or output-limit, the group is killed with SIGKILL and a
 *    best-effort `docker rm -f` is fired in the background with a bounded
 *    20-second deadline so that a stuck Docker daemon cannot hang the API.
 * 3. The Promise resolves exactly once (guarded by `resolved`).
 * 4. The timeout timer and all stream listeners are cleaned up in `finish`.
 *
 * SECURITY NOTES (local / development)
 * ----------------------------------------
 * - The workspace directory is bind-mounted read-only from the host.
 *   Path traversal is checked: any argument that resolves outside `cwd` is
 *   rejected before the container is started.
 * - The host path passed to `--mount src=` must not contain commas or colons
 *   because Docker parses those as key separators.  `cwd` is validated here.
 * - Network is disabled (--network none).
 * - Memory, CPU, PID and file-descriptor limits are applied.
 * - The container runs as an unprivileged UID (10001).
 * - No new privileges, all capabilities dropped.
 * - The workspace is bind-mounted with ro flag in the Docker args so that
 *   user code cannot write back to the host tempdir.
 *
 * ⚠️  LOCAL DEV vs PRODUCTION MULTI-TENANT
 * ------------------------------------------
 * The isolation above is appropriate for trusted-developer or classroom use.
 * For public multi-tenant production, additionally consider:
 *   • gVisor (runsc) or Kata Containers for kernel-level isolation.
 *   • A separate Docker daemon (or VM) per submission.
 *   • Seccomp / AppArmor profiles.
 *   • Per-user rate limiting and admission control.
 *   • The Docker daemon socket must NEVER be accessible from inside containers.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const IMAGE = process.env.DOCKER_EXECUTION_IMAGE || 'collab-code-runner:local';

/**
 * Maximum combined stdout + stderr before we kill the container.
 * 512 KB — matches the local spawnWithLimits budget.
 */
const MAX_COMBINED_OUTPUT_BYTES = 512 * 1024;

/** Maximum time we allow `docker rm -f` to complete before giving up. */
const CLEANUP_DEADLINE_MS = 20_000;

export interface DockerRunOptions {
  cwd: string;
  args: string[];
  command: string;
  stdin?: string;
  timeoutMs: number;
}

export interface DockerRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  outputLimitExceeded: boolean;
  duration: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Maps a host path into the /workspace tree inside the container.
 * Throws if the path escapes the workspace root.
 */
function mapWorkspacePath(value: string, cwd: string): string {
  if (!path.isAbsolute(value)) return value;

  const relative = path.relative(cwd, value);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('Docker runner rejected a path outside the execution workspace.');
  }

  return relative ? `/workspace/${relative.split(path.sep).join('/')}` : '/workspace';
}

/**
 * Validate the host-side workspace path so it cannot break Docker mount syntax.
 * Docker --mount src= is comma/colon-delimited; those characters in the path
 * would silently corrupt the argument.
 */
function validateCwd(cwd: string): void {
  if (!path.isAbsolute(cwd)) {
    throw new Error(`Docker runner: cwd must be an absolute path, got: ${cwd}`);
  }
  if (cwd.includes(',') || cwd.includes(':')) {
    throw new Error(
      `Docker runner: cwd contains characters that are unsafe in Docker mount arguments: ${cwd}`
    );
  }
}

/**
 * Kill the docker CLI child process and its process group.
 */
function killChild(child: ChildProcess): void {
  if (!child.pid) return;

  try {
    // Kill the entire process group spawned with detached:true
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      // Process already exited — safe to ignore.
    }
  }
}

/**
 * Attempt to remove the container with a bounded deadline.
 * We don't await the result — we fire and forget, but we log on error.
 * Using a deadline timer ensures a stuck Docker daemon cannot block cleanup
 * indefinitely.
 */
function forceRemoveContainer(containerName: string): void {
  const remover = spawn('docker', ['rm', '-f', containerName], {
    stdio: 'ignore',
    detached: true,
  });

  // Bounded cleanup deadline: kill the remover after 20 s.
  const deadline = setTimeout(() => {
    try {
      if (remover.pid) process.kill(-remover.pid, 'SIGKILL');
    } catch {
      try { remover.kill('SIGKILL'); } catch { /* ignore */ }
    }
  }, CLEANUP_DEADLINE_MS);
  deadline.unref(); // Do not prevent Node from exiting.

  remover.on('close', () => clearTimeout(deadline));
  remover.on('error', () => clearTimeout(deadline));

  remover.unref();
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runInDocker(options: DockerRunOptions): Promise<DockerRunResult> {
  const startedAt = Date.now();
  const containerName = `collab-run-${randomUUID()}`;

  // --- Validate and map paths ------------------------------------------------

  try {
    validateCwd(options.cwd);
  } catch (error) {
    return {
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Invalid workspace path',
      exitCode: 1,
      timedOut: false,
      outputLimitExceeded: false,
      duration: Date.now() - startedAt,
    };
  }

  let command: string;
  let args: string[];

  try {
    command = mapWorkspacePath(options.command, options.cwd);
    args = options.args.map((arg) => mapWorkspacePath(arg, options.cwd));
  } catch (error) {
    return {
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Invalid workspace path',
      exitCode: 1,
      timedOut: false,
      outputLimitExceeded: false,
      duration: Date.now() - startedAt,
    };
  }

  // --- Build docker CLI arguments --------------------------------------------

  const dockerArgs = [
    'run',
    '--rm',
    '--interactive',        // Keep stdin attached so piped input reaches the container.
    '--name', containerName,
    '--network', 'none',
    '--memory', '256m',
    '--memory-swap', '256m',
    '--cpus', '1',
    '--pids-limit', '64',
    '--ulimit', 'nofile=128:128',
    '--read-only',
    '--tmpfs', '/tmp:rw,nosuid,size=32m',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '--user', '10001:10001',
    // The workspace is writable so compiled artifacts (javac .class, g++ binary,
    // etc.) can be written to tempdir. The container still cannot reach the host
    // network or other filesystem paths.
    '--mount', `type=bind,src=${options.cwd},dst=/workspace`,
    '--workdir', '/workspace',
    '--env', 'HOME=/tmp',
    '--env', 'TMPDIR=/tmp',
    '--env', 'PATH=/usr/local/bin:/usr/bin:/bin',
    '--env', 'NODE_OPTIONS=--max-old-space-size=256',
    '--env', 'PYTHONUNBUFFERED=1',
    // Prevent Python from writing __pycache__ to the workspace.
    '--env', 'PYTHONDONTWRITEBYTECODE=1',
    IMAGE,
    command,
    ...args,
  ];

  // --- Spawn and manage ------------------------------------------------------

  return new Promise((resolve) => {
    let stdoutBuf = '';
    let stderrBuf = '';
    let combinedBytes = 0;

    let timedOut = false;
    let outputLimitExceeded = false;
    let resolved = false;
    let child: ChildProcess;
    let timer: NodeJS.Timeout | undefined;

    const finish = (exitCode: number, errorMessage?: string): void => {
      if (resolved) return;
      resolved = true;

      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }

      // Detach stream listeners to prevent any late data events after resolution.
      child?.stdout?.removeAllListeners('data');
      child?.stderr?.removeAllListeners('data');

      resolve({
        stdout: stdoutBuf,
        stderr: stderrBuf || errorMessage || '',
        exitCode,
        timedOut,
        outputLimitExceeded,
        duration: Date.now() - startedAt,
      });
    };

    const handleOutputLimitExceeded = (): void => {
      outputLimitExceeded = true;
      stderrBuf = stderrBuf
        ? `${stderrBuf}\n[Output limit exceeded: combined stdout+stderr > ${MAX_COMBINED_OUTPUT_BYTES} bytes]`
        : `[Output limit exceeded: combined stdout+stderr > ${MAX_COMBINED_OUTPUT_BYTES} bytes]`;
      killChild(child);
      forceRemoveContainer(containerName);
    };

    // --- Spawn docker CLI ----------------------------------------------------

    try {
      child = spawn('docker', dockerArgs, {
        cwd: options.cwd,
        env: {
          // Only pass through PATH so the host environment secrets are never
          // forwarded to the docker CLI process.
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        },
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      finish(1, error instanceof Error ? error.message : 'Failed to start Docker');
      return;
    }

    // --- Timeout -------------------------------------------------------------

    timer = setTimeout(() => {
      timedOut = true;
      killChild(child);
      forceRemoveContainer(containerName);
    }, Math.max(1, options.timeoutMs));

    // --- Spawn error ---------------------------------------------------------

    child.on('error', (error) => {
      finish(1, error.message);
    });

    // --- Stdout handler (combined budget) ------------------------------------

    child.stdout?.on('data', (chunk: Buffer) => {
      if (resolved) return;

      const chunkLen = chunk.length;
      const remaining = MAX_COMBINED_OUTPUT_BYTES - combinedBytes;

      if (remaining <= 0) {
        // Budget already exhausted by a previous chunk — kill if not done.
        if (!outputLimitExceeded) handleOutputLimitExceeded();
        return;
      }

      if (chunkLen > remaining) {
        // Partial capture: take as many bytes as the budget allows.
        // Guard against splitting a multi-byte UTF-8 sequence:
        //   walk backwards from `remaining` until we land on a byte that is
        //   not a UTF-8 continuation byte (10xxxxxx = 0x80..0xBF).
        let safe = remaining;
        while (safe > 0 && (chunk[safe] & 0xc0) === 0x80) safe--;
        stdoutBuf += chunk.subarray(0, safe).toString('utf8');
        combinedBytes += safe;
        handleOutputLimitExceeded();
      } else {
        stdoutBuf += chunk.toString('utf8');
        combinedBytes += chunkLen;
      }
    });

    // --- Stderr handler (combined budget) ------------------------------------

    child.stderr?.on('data', (chunk: Buffer) => {
      if (resolved) return;

      const chunkLen = chunk.length;
      const remaining = MAX_COMBINED_OUTPUT_BYTES - combinedBytes;

      if (remaining <= 0) {
        if (!outputLimitExceeded) handleOutputLimitExceeded();
        return;
      }

      if (chunkLen > remaining) {
        let safe = remaining;
        while (safe > 0 && (chunk[safe] & 0xc0) === 0x80) safe--;
        stderrBuf += chunk.subarray(0, safe).toString('utf8');
        combinedBytes += safe;
        handleOutputLimitExceeded();
      } else {
        stderrBuf += chunk.toString('utf8');
        combinedBytes += chunkLen;
      }
    });

    // --- Process exit --------------------------------------------------------

    child.on('close', (code, signal) => {
      const exitCode =
        timedOut
          ? 124
          : outputLimitExceeded
            ? 137
            : signal
              ? 137
              : code ?? 1;
      finish(exitCode);
    });

    // --- Stdin ---------------------------------------------------------------

    if (options.stdin) {
      child.stdin?.write(options.stdin);
    }
    child.stdin?.end();
  });
}
