import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { runInDocker } from './dockerRunner.service';

export type ExecutionStatus =
  | 'success'
  | 'error'
  | 'timeout'
  | 'compile_error'
  | 'runtime_error'
  | 'output_limit_exceeded'
  | 'unavailable';

export interface ExecutionRequest {
  language: string;
  code: string;
  stdin?: string;
  timeoutMs?: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  status: ExecutionStatus;
  memoryUsageBytes?: number;
}

export type Verdict =
  | 'accepted'
  | 'wrong_answer'
  | 'compile_error'
  | 'runtime_error'
  | 'time_limit'
  | 'output_limit'
  | 'judge_error';

export interface TestCaseItem {
  input: string;
  expectedOutput?: string;
  isHidden?: boolean;
}

export interface TestCaseEvaluationItem {
  index: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  userStdout?: string;
  passed: boolean;
  status: 'passed' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'timeout' | 'output_limit' | 'judge_error' | 'executed';
  executionTimeMs: number;
  stderr?: string;
  errorMessage?: string;
}

export interface TestSuiteEvaluationResult {
  allPassed: boolean;
  totalCases: number;
  passedCases: number;
  status: Verdict;
  testResults: TestCaseEvaluationItem[];
  totalTimeMs: number;
  compilerError?: string;
  runtimeError?: string;
}

export type ComparisonPolicy = 'exact' | 'token' | 'float' | 'structured';

export interface ComparisonOptions {
  policy?: ComparisonPolicy;
  floatTolerance?: number;
  unorderedArray?: boolean;
}

const LANGUAGE_CONFIG: Record<string, { language: string; version: string }> = {
  javascript: { language: 'javascript', version: '18.15.0' },
  typescript: { language: 'typescript', version: '5.0.3' },
  python: { language: 'python', version: '3.10.0' },
  java: { language: 'java', version: '15.0.2' },
  cpp: { language: 'c++', version: '10.2.0' },
  go: { language: 'go', version: '1.16.2' },
  rust: { language: 'rust', version: '1.50.0' },
};

// Judge0 CE language IDs (https://ce.judge0.com)
const JUDGE0_LANGUAGE_IDS: Record<string, number> = {
  java: 91,       // Java (JDK 17.0.6)
  python: 92,     // Python (3.11.2)
  javascript: 93, // JavaScript (Node.js 18.15.0)
  typescript: 94, // TypeScript (5.0.3)
  cpp: 105,       // C++ (GCC 14.1.0)
  go: 60,         // Go (1.13.5)
  rust: 73,       // Rust (1.40.0)
};

const JUDGE0_CE_URL = 'https://ce.judge0.com';

const MAX_OUTPUT_BYTES = 512 * 1024; // 512 KB output limit protection

/**
 * Creates a sanitized environment without sensitive host secrets or environment variables.
 */
function createSandboxEnv(tempDir: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH || '/usr/bin:/bin:/usr/local/bin:/usr/sbin:/sbin',
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8',
    TMPDIR: tempDir,
    HOME: tempDir,
    NODE_OPTIONS: '--max-old-space-size=256',
    PYTHONUNBUFFERED: '1',
  };
}

/**
 * Safely kills a child process and its entire process tree/group.
 */
function killProcessGroup(child: ChildProcess): void {
  if (!child.pid) return;
  try {
    // Kill the detached process group
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      // Process already terminated
    }
  }
}

/**
 * Executes a single command in an isolated temporary directory with timeouts,
 * process group killing, output limits, and safe environment variables.
 */
async function spawnWithLimits(
  command: string,
  args: string[],
  options: {
    cwd: string;
    stdin?: string;
    timeoutMs: number;
    env?: NodeJS.ProcessEnv;
  }
): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut: boolean; outputLimitExceeded: boolean; duration: number }> {
  if (process.env.DOCKER_EXECUTION === 'true') {
    return runInDocker({
      command,
      args,
      cwd: options.cwd,
      stdin: options.stdin,
      timeoutMs: options.timeoutMs,
    });
  }

  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let outputLimitExceeded = false;
    let resolved = false;

    let child: ChildProcess;
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env || createSandboxEnv(options.cwd),
        detached: true,
      });
    } catch (err: any) {
      return resolve({
        stdout: '',
        stderr: err?.message || 'Failed to spawn process',
        exitCode: 1,
        timedOut: false,
        outputLimitExceeded: false,
        duration: Date.now() - startTime,
      });
    }

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessGroup(child);
    }, options.timeoutMs);

    // Stdin handling
    if (child.stdin) {
      try {
        if (options.stdin !== undefined && options.stdin !== null) {
          child.stdin.write(options.stdin);
        }
        child.stdin.end();
      } catch {
        // Stream may already be closed
      }
    }

    child.stdout?.on('data', (data: Buffer) => {
      if (stdout.length + data.length > MAX_OUTPUT_BYTES) {
        outputLimitExceeded = true;
        stdout += data.subarray(0, Math.max(0, MAX_OUTPUT_BYTES - stdout.length)).toString('utf-8');
        killProcessGroup(child);
      } else {
        stdout += data.toString('utf-8');
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      if (stderr.length + data.length > MAX_OUTPUT_BYTES) {
        stderr += data.subarray(0, Math.max(0, MAX_OUTPUT_BYTES - stderr.length)).toString('utf-8');
      } else {
        stderr += data.toString('utf-8');
      }
    });

    child.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: stderr || err.message,
        exitCode: 1,
        timedOut: false,
        outputLimitExceeded,
        duration: Date.now() - startTime,
      });
    });

    child.on('close', (code, signal) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      const duration = Date.now() - startTime;
      const finalCode = timedOut ? 124 : outputLimitExceeded ? 137 : signal ? 128 + 9 : code ?? 0;
      resolve({
        stdout,
        stderr,
        exitCode: finalCode,
        timedOut,
        outputLimitExceeded,
        duration,
      });
    });
  });
}

/**
 * Isolated Code Execution Service (Local Sandbox Engine)
 *
 * Implements real multi-stage compilation and execution:
 * - Java: javac -> java
 * - C++: clang++ -> binary execution
 * - Python: syntax compile check -> python3
 * - JavaScript: node syntax check -> node execution
 */
export async function executeLocally(req: ExecutionRequest): Promise<ExecutionResult> {
  const startTime = Date.now();
  const lang = req.language.toLowerCase();
  const runId = randomUUID();
  const tempDir = path.join(os.tmpdir(), 'collab-code-exec', runId);

  await fs.mkdir(tempDir, { recursive: true });

  try {
    if (process.env.DOCKER_EXECUTION === 'true') {
      await fs.chmod(tempDir, 0o777);
    }

    const timeoutMs = req.timeoutMs || 8000;
    const compileTimeoutMs = 12000;

    // ─── 1. JAVASCRIPT / TYPESCRIPT ──────────────────────────────
    if (lang === 'javascript' || lang === 'typescript') {
      const isTs = lang === 'typescript';
      const fileName = isTs ? 'main.ts' : 'main.js';
      const filePath = path.join(tempDir, fileName);
      await fs.writeFile(filePath, req.code, 'utf-8');

      let command = 'node';
      let args = ['--max-old-space-size=256', filePath];

      if (isTs) {
        const localTsx = path.resolve(__dirname, '../../node_modules/.bin/tsx');
        const hasLocalTsx = await fs.stat(localTsx).then(() => true).catch(() => false);
        command = process.env.DOCKER_EXECUTION === 'true' ? 'tsx' : (hasLocalTsx ? localTsx : 'tsx');
        args = [filePath];
      } else {
        // Fast syntax check for pure JavaScript
        const syntaxCheck = await spawnWithLimits('node', ['--check', filePath], {
          cwd: tempDir,
          timeoutMs: compileTimeoutMs,
        });

        if (syntaxCheck.exitCode !== 0) {
          return {
            stdout: '',
            stderr: syntaxCheck.stderr || 'Syntax Error',
            exitCode: syntaxCheck.exitCode,
            executionTimeMs: Date.now() - startTime,
            status: 'compile_error',
          };
        }
      }

      const runRes = await spawnWithLimits(command, args, {
        cwd: tempDir,
        stdin: req.stdin,
        timeoutMs,
      });

      if (runRes.timedOut) {
        return {
          stdout: runRes.stdout,
          stderr: runRes.stderr || 'Time Limit Exceeded (execution timed out).',
          exitCode: 124,
          executionTimeMs: runRes.duration,
          status: 'timeout',
        };
      }

      if (runRes.outputLimitExceeded) {
        return {
          stdout: runRes.stdout,
          stderr: 'Output Limit Exceeded (maximum buffer limit 512KB reached).',
          exitCode: 137,
          executionTimeMs: runRes.duration,
          status: 'output_limit_exceeded',
        };
      }

      if (runRes.exitCode !== 0) {
        const isSyntax = runRes.stderr.includes('SyntaxError');
        return {
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          exitCode: runRes.exitCode,
          executionTimeMs: runRes.duration,
          status: isSyntax ? 'compile_error' : 'error',
        };
      }

      return {
        stdout: runRes.stdout,
        stderr: runRes.stderr,
        exitCode: 0,
        executionTimeMs: runRes.duration,
        status: 'success',
      };
    }

    // ─── 2. PYTHON ──────────────────────────────────────────────
    if (lang === 'python') {
      const filePath = path.join(tempDir, 'main.py');
      await fs.writeFile(filePath, req.code, 'utf-8');

      // Syntax check via py_compile.
      // PYTHONDONTWRITEBYTECODE prevents __pycache__ creation in the workspace,
      // which would fail if the mount is read-only in Docker mode.
      const syntaxCheck = await spawnWithLimits('python3', ['-B', '-m', 'py_compile', filePath], {
        cwd: tempDir,
        timeoutMs: compileTimeoutMs,
      });

      if (syntaxCheck.exitCode !== 0) {
        return {
          stdout: '',
          stderr: syntaxCheck.stderr || 'Python SyntaxError',
          exitCode: syntaxCheck.exitCode,
          executionTimeMs: Date.now() - startTime,
          status: 'compile_error',
        };
      }

      const runRes = await spawnWithLimits('python3', ['-B', '-u', filePath], {
        cwd: tempDir,
        stdin: req.stdin,
        timeoutMs,
      });

      if (runRes.timedOut) {
        return {
          stdout: runRes.stdout,
          stderr: runRes.stderr || 'Time Limit Exceeded (execution timed out).',
          exitCode: 124,
          executionTimeMs: runRes.duration,
          status: 'timeout',
        };
      }

      if (runRes.outputLimitExceeded) {
        return {
          stdout: runRes.stdout,
          stderr: 'Output Limit Exceeded (maximum buffer limit 512KB reached).',
          exitCode: 137,
          executionTimeMs: runRes.duration,
          status: 'output_limit_exceeded',
        };
      }

      if (runRes.exitCode !== 0) {
        return {
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          exitCode: runRes.exitCode,
          executionTimeMs: runRes.duration,
          status: 'error',
        };
      }

      return {
        stdout: runRes.stdout,
        stderr: runRes.stderr,
        exitCode: 0,
        executionTimeMs: runRes.duration,
        status: 'success',
      };
    }

    // ─── 3. C++ ──────────────────────────────────────────────────
    if (lang === 'cpp' || lang === 'c++') {
      const srcPath = path.join(tempDir, 'main.cpp');
      const binPath = path.join(tempDir, 'main');
      await fs.writeFile(srcPath, req.code, 'utf-8');

      // Stage 1: Real Compilation with clang++ / g++
      const compileRes = await spawnWithLimits(process.env.DOCKER_EXECUTION === 'true' ? 'g++' : 'clang++', ['-O2', '-std=c++17', srcPath, '-o', binPath], {
        cwd: tempDir,
        timeoutMs: compileTimeoutMs,
      });

      if (compileRes.timedOut) {
        return {
          stdout: '',
          stderr: 'Compilation timed out (compiler resource limit reached).',
          exitCode: 124,
          executionTimeMs: Date.now() - startTime,
          status: 'compile_error',
        };
      }

      if (compileRes.exitCode !== 0) {
        return {
          stdout: '',
          stderr: compileRes.stderr || 'C++ Compilation Failed',
          exitCode: compileRes.exitCode,
          executionTimeMs: Date.now() - startTime,
          status: 'compile_error',
        };
      }

      // Stage 2: Sandboxed Binary Execution
      const runRes = await spawnWithLimits(binPath, [], {
        cwd: tempDir,
        stdin: req.stdin,
        timeoutMs,
      });

      if (runRes.timedOut) {
        return {
          stdout: runRes.stdout,
          stderr: runRes.stderr || 'Time Limit Exceeded (execution timed out).',
          exitCode: 124,
          executionTimeMs: runRes.duration,
          status: 'timeout',
        };
      }

      if (runRes.outputLimitExceeded) {
        return {
          stdout: runRes.stdout,
          stderr: 'Output Limit Exceeded (maximum buffer limit 512KB reached).',
          exitCode: 137,
          executionTimeMs: runRes.duration,
          status: 'output_limit_exceeded',
        };
      }

      if (runRes.exitCode !== 0) {
        return {
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          exitCode: runRes.exitCode,
          executionTimeMs: runRes.duration,
          status: 'error',
        };
      }

      return {
        stdout: runRes.stdout,
        stderr: runRes.stderr,
        exitCode: 0,
        executionTimeMs: runRes.duration,
        status: 'success',
      };
    }

    // ─── 4. JAVA ─────────────────────────────────────────────────
    if (lang === 'java') {
      const srcPath = path.join(tempDir, 'Main.java');
      await fs.writeFile(srcPath, req.code, 'utf-8');

      // Stage 1: Real Compilation with javac
      const compileRes = await spawnWithLimits('javac', ['-encoding', 'UTF-8', '-d', tempDir, srcPath], {
        cwd: tempDir,
        timeoutMs: compileTimeoutMs,
      });

      if (compileRes.timedOut) {
        return {
          stdout: '',
          stderr: 'Java compilation timed out.',
          exitCode: 124,
          executionTimeMs: Date.now() - startTime,
          status: 'compile_error',
        };
      }

      if (compileRes.exitCode !== 0) {
        return {
          stdout: '',
          stderr: compileRes.stderr || 'Java Compilation Error',
          exitCode: compileRes.exitCode,
          executionTimeMs: Date.now() - startTime,
          status: 'compile_error',
        };
      }

      // Stage 2: JVM Execution with memory limits
      const runRes = await spawnWithLimits('java', ['-Xmx256m', '-Xss32m', '-XX:+UseSerialGC', '-cp', tempDir, 'Main'], {
        cwd: tempDir,
        stdin: req.stdin,
        timeoutMs,
      });

      if (runRes.timedOut) {
        return {
          stdout: runRes.stdout,
          stderr: runRes.stderr || 'Time Limit Exceeded (execution timed out).',
          exitCode: 124,
          executionTimeMs: runRes.duration,
          status: 'timeout',
        };
      }

      if (runRes.outputLimitExceeded) {
        return {
          stdout: runRes.stdout,
          stderr: 'Output Limit Exceeded (maximum buffer limit 512KB reached).',
          exitCode: 137,
          executionTimeMs: runRes.duration,
          status: 'output_limit_exceeded',
        };
      }

      if (runRes.exitCode !== 0) {
        return {
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          exitCode: runRes.exitCode,
          executionTimeMs: runRes.duration,
          status: 'error',
        };
      }

      return {
        stdout: runRes.stdout,
        stderr: runRes.stderr,
        exitCode: 0,
        executionTimeMs: runRes.duration,
        status: 'success',
      };
    }

    return {
      stdout: '',
      stderr: `Language '${req.language}' is not supported in the local runner. Supported: javascript, typescript, python, java, cpp`,
      exitCode: 1,
      executionTimeMs: 0,
      status: 'error',
    };
  } catch (err: any) {
    return {
      stdout: '',
      stderr: err.message || 'Execution failed',
      exitCode: 1,
      executionTimeMs: Date.now() - startTime,
      status: 'error',
    };
  } finally {
    fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Top-level Code Execution entry point.
 * In production (no local javac/g++), routes to Judge0 CE cloud sandbox.
 * Falls back to local sandbox for local dev when compilers are available.
 */
export async function executeCode(req: ExecutionRequest): Promise<ExecutionResult> {
  const langConfig = LANGUAGE_CONFIG[req.language.toLowerCase()];
  if (!langConfig) {
    return {
      stdout: '',
      stderr: `Language "${req.language}" is not supported. Supported: ${Object.keys(LANGUAGE_CONFIG).join(', ')}`,
      exitCode: 1,
      executionTimeMs: 0,
      status: 'error',
    };
  }

  // In production (Render/cloud), use Judge0 CE as the execution backend.
  // Locally, fall back to spawning compilers directly.
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    return executeViaJudge0(req);
  }

  return executeLocally(req);
}

/**
 * Executes code via Judge0 CE public API (https://ce.judge0.com).
 * Free, no auth required, supports Java 17, Python 3.11, Node 18, C++ GCC 14, TypeScript 5.
 */
async function executeViaJudge0(req: ExecutionRequest): Promise<ExecutionResult> {
  const lang = req.language.toLowerCase();
  const languageId = JUDGE0_LANGUAGE_IDS[lang];
  const startTime = Date.now();

  if (!languageId) {
    return executeLocally(req);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(`${JUDGE0_CE_URL}/submissions?base64_encoded=false&wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language_id: languageId,
        source_code: req.code,
        stdin: req.stdin || '',
        cpu_time_limit: Math.ceil((req.timeoutMs || 10000) / 1000),
        wall_time_limit: Math.ceil((req.timeoutMs || 10000) / 1000) + 5,
        memory_limit: 256000, // 256 MB
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      console.error(`[Judge0] API error: ${response.status} ${response.statusText}`);
      return executeLocally(req);
    }

    const data = (await response.json()) as {
      stdout?: string;
      stderr?: string;
      compile_output?: string;
      message?: string;
      time?: string;
      memory?: number;
      status?: { id: number; description: string };
    };

    const statusId = data.status?.id ?? 0;
    const stdout = data.stdout || '';
    const stderr = data.stderr || data.message || '';
    const compileOutput = data.compile_output || '';

    // Status IDs: 1=In Queue, 2=Processing, 3=Accepted, 4=WA, 5=TLE, 6=CE, 7-12=Runtime errors, 13=Internal error, 14=Exec format error
    if (statusId === 6) {
      // Compilation Error
      return {
        stdout: '',
        stderr: compileOutput || stderr || 'Compilation error',
        exitCode: 1,
        executionTimeMs: duration,
        status: 'compile_error',
      };
    }

    if (statusId === 5) {
      // Time Limit Exceeded
      return {
        stdout,
        stderr: 'Execution timed out (Time Limit Exceeded).',
        exitCode: 137,
        executionTimeMs: duration,
        status: 'timeout',
      };
    }

    if (statusId >= 7 && statusId <= 12) {
      // Runtime errors (SIGSEGV, SIGFPE, SIGABRT, NZEC, etc.)
      return {
        stdout,
        stderr: stderr || `Runtime Error (${data.status?.description || 'unknown'})`,
        exitCode: 1,
        executionTimeMs: duration,
        status: 'error',
      };
    }

    if (statusId === 3) {
      // Accepted
      return {
        stdout,
        stderr,
        exitCode: 0,
        executionTimeMs: duration,
        status: 'success',
      };
    }

    // Other statuses (in queue, processing, internal error)
    return {
      stdout,
      stderr: stderr || data.message || `Judge status: ${data.status?.description || statusId}`,
      exitCode: statusId === 3 ? 0 : 1,
      executionTimeMs: duration,
      status: statusId === 3 ? 'success' : 'error',
    };
  } catch (err) {
    console.error('[Judge0] Request failed, falling back to local:', err);
    return executeLocally(req);
  }
}

// ─── Output Comparison & Judging Engine ───────────────────────

/**
 * Normalizes output string for standardized comparison.
 * Parses JSON when possible (e.g. arrays [0, 1] -> [0,1]),
 * and trims whitespace line-by-line while preserving structural content.
 */
export function normalizeOutput(val: string): string {
  if (val === undefined || val === null) return '';
  const trimmed = String(val).trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  try {
    const parsed = JSON.parse(trimmed);
    return JSON.stringify(parsed);
  } catch {
    return trimmed
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ',')
      .replace(/\[\s*/g, '[')
      .replace(/\s*\]/g, ']')
      .toLowerCase();
  }
}

/**
 * Compares actual program output with expected output.
 * Never marks missing expected output as correct in judging mode.
 * Handles exact matching, structured JSON, unordered arrays, numbers, and booleans.
 */
export function compareOutputs(
  actual: string,
  expected?: string,
  problemSlug?: string,
  options?: ComparisonOptions
): boolean {
  // Reject missing expected output in validation
  if (expected === undefined || expected === null) {
    return false;
  }

  const normActual = normalizeOutput(actual);
  const normExpected = normalizeOutput(expected);

  // Exact match
  if (normActual === normExpected) {
    return true;
  }

  // If actual is empty but expected is non-empty, definitely wrong answer!
  if (normActual === '' && normExpected !== '') {
    return false;
  }
  if (normActual !== '' && normExpected === '') {
    return false;
  }

  const policy = options?.policy || 'structured';
  const floatTol = options?.floatTolerance ?? 1e-6;
  const isUnordered = options?.unorderedArray ?? (problemSlug?.toLowerCase().replace(/_/g, '-') === 'two-sum');

  // 1. Structured JSON Comparison
  if (policy === 'structured') {
    try {
      const actClean = normActual.replace(/'/g, '"');
      const expClean = normExpected.replace(/'/g, '"');
      const actJson = JSON.parse(actClean);
      const expJson = JSON.parse(expClean);

      // Array comparison
      if (Array.isArray(actJson) && Array.isArray(expJson)) {
        if (actJson.length !== expJson.length) return false;
        if (isUnordered) {
          const sortA = [...actJson].sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))));
          const sortB = [...expJson].sort((a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))));
          return JSON.stringify(sortA) === JSON.stringify(sortB);
        }
        return JSON.stringify(actJson) === JSON.stringify(expJson);
      }

      // Boolean comparison
      if (typeof actJson === 'boolean' && typeof expJson === 'boolean') {
        return actJson === expJson;
      }

      // Number comparison with tolerance
      if (typeof actJson === 'number' && typeof expJson === 'number') {
        return Math.abs(actJson - expJson) <= floatTol;
      }

      // String comparison
      if (typeof actJson === 'string' && typeof expJson === 'string') {
        return actJson === expJson;
      }

      // Generic Object
      if (typeof actJson === 'object' && typeof expJson === 'object') {
        return JSON.stringify(actJson) === JSON.stringify(expJson);
      }
    } catch {
      // Fall through to typed scalar comparison
    }

    // Booleans: "true" vs "True"
    const actLower = normActual.toLowerCase();
    const expLower = normExpected.toLowerCase();
    if (
      (actLower === 'true' && (expLower === 'true' || expLower === '1')) ||
      (actLower === 'false' && (expLower === 'false' || expLower === '0'))
    ) {
      return true;
    }

    // Quoted string vs unquoted string (e.g. "olleh" vs olleh, "edoCballoC" vs edocballoc)
    const unquoteA = normActual.startsWith('"') && normActual.endsWith('"') ? normActual.slice(1, -1) : normActual;
    const unquoteB = normExpected.startsWith('"') && normExpected.endsWith('"') ? normExpected.slice(1, -1) : normExpected;
    if (unquoteA === unquoteB || unquoteA.toLowerCase() === unquoteB.toLowerCase()) {
      return true;
    }

    // Strict number comparison (non-empty strings only!)
    if (
      normActual.trim() !== '' &&
      normExpected.trim() !== '' &&
      !isNaN(Number(normActual)) &&
      !isNaN(Number(normExpected))
    ) {
      const numAct = Number(normActual);
      const numExp = Number(normExpected);
      return Math.abs(numAct - numExp) <= floatTol;
    }
  }

  // 2. Token-based comparison (tokens must match in order)
  if (policy === 'token') {
    const tokensAct = normActual.split(/\s+/).filter(Boolean);
    const tokensExp = normExpected.split(/\s+/).filter(Boolean);
    if (tokensAct.length !== tokensExp.length) return false;
    for (let i = 0; i < tokensAct.length; i++) {
      if (tokensAct[i] !== tokensExp[i]) return false;
    }
    return true;
  }

  // 3. Float comparison
  if (policy === 'float') {
    const numAct = Number(normActual);
    const numExp = Number(normExpected);
    if (!isNaN(numAct) && !isNaN(numExp)) {
      return Math.abs(numAct - numExp) <= floatTol;
    }
  }

  // By default for standard output, compare line by line with trailing space trimmed
  return normActual === normExpected;
}

// ─── Problem Harness Generation ───────────────────────────────

function getCandidateFunctionNames(problemSlug?: string, code?: string): string[] {
  const baseList = [
    'twoSum', 'two_sum',
    'reverseString', 'reverse_string',
    'search', 'binarySearch', 'binary_search',
    'isValid', 'is_valid', 'validParentheses', 'valid_parentheses',
    'maxSubArray', 'max_sub_array', 'maximumSubarray', 'maximum_subarray',
    'threeSum', 'three_sum',
    'isPalindrome', 'is_palindrome',
    'letterCombinations', 'letter_combinations',
    'solve', 'solution'
  ];

  const helpers = new Set(['fun', 'helper', 'solve', 'dfs', 'bfs', 'backtrack', 'recurse', 'traverse', 'f']);
  const codeMethods: string[] = [];
  const helperMethods: string[] = [];

  if (code) {
    const fnMatches = code.matchAll(/(?:public|def|function)\s+(?:[\w<>[\]]+\s+)?(\w+)\s*\(/g);
    for (const m of fnMatches) {
      const fnName = m[1];
      if (fnName && fnName !== 'main' && fnName !== 'Solution') {
        if (helpers.has(fnName.toLowerCase())) {
          helperMethods.push(fnName);
        } else {
          codeMethods.push(fnName);
        }
      }
    }
  }

  const slugNames: string[] = [];
  if (problemSlug) {
    const slug = problemSlug.toLowerCase().replace(/_/g, '-');
    const camel = slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
    const snake = slug.replace(/-/g, '_');

    slugNames.push(camel, snake, slug);
    if (slug.includes('search')) slugNames.push('search');
    if (slug.includes('valid')) slugNames.push('isValid', 'is_valid');
    if (slug.includes('reverse')) slugNames.push('reverseString', 'reverse_string');
    if (slug.includes('max')) slugNames.push('maxSubArray', 'max_sub_array');
    if (slug.includes('two')) slugNames.push('twoSum', 'two_sum');
    if (slug.includes('three') || slug.includes('3sum')) slugNames.push('threeSum', 'three_sum');
    if (slug.includes('palindrome')) slugNames.push('isPalindrome', 'is_palindrome');
    if (slug.includes('letter') || slug.includes('phone') || slug.includes('combination')) {
      slugNames.push('letterCombinations', 'letter_combinations', 'letterCombination', 'letter_combination');
    }
    if (slug.includes('swap') || slug.includes('pair')) {
      slugNames.push('swapPairs', 'swap_pairs');
    }
  }

  return Array.from(new Set([...codeMethods, ...slugNames, ...baseList, ...helperMethods]));
}

/**
 * Checks if code contains a standalone main entry point for Standard I/O.
 */
export function isStandardIoProgram(code: string, language: string): boolean {
  const lang = language.toLowerCase();
  if (lang === 'cpp' || lang === 'c++') {
    return /\bint\s+main\s*\(/.test(code);
  }
  if (lang === 'java') {
    return /public\s+static\s+void\s+main\s*\(/.test(code);
  }
  if (lang === 'python') {
    return /sys\.stdin|input\s*\(/.test(code) && !/class\s+Solution|def\s+two_sum|def\s+search|def\s+is_valid|def\s+reverse_string|def\s+max_sub_array/.test(code);
  }
  if (lang === 'javascript' || lang === 'typescript') {
    return /process\.stdin|fs\.readFileSync\s*\(0|readline/.test(code);
  }
  return false;
}

/**
 * Generates an execution harness for LeetCode-style function-based problems.
 * User code return value is serialized strictly as __LEETCODE_RESULT__:<json>.
 * User print statements are captured as __LEETCODE_STDOUT__:<json>.
 */
export function buildTestHarness(
  code: string,
  language: string,
  input: string,
  problemSlug?: string
): { code: string; stdin: string; isFunctionBased: boolean } {
  const lang = language.toLowerCase();

  // If user wrote complete Standard I/O program, run directly
  if (isStandardIoProgram(code, language)) {
    return { code, stdin: input, isFunctionBased: false };
  }

  const candidateNames = getCandidateFunctionNames(problemSlug, code);

  // 1. JavaScript / TypeScript Harness
  if (lang === 'javascript' || lang === 'typescript') {
    const harness = `
// ─── Collab Code LeetCode Test Harness ───
const _userLogs = [];
const _origLog = console.log;
const _origWarn = console.warn;
const _origErr = console.error;

console.log = (...args) => {
  _userLogs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
};
console.warn = (...args) => {
  _userLogs.push('[warn] ' + args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
};
console.error = (...args) => {
  _userLogs.push('[error] ' + args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
};

// User code:
${code}

try {
  let _fn = null;
  const _candidates = ${JSON.stringify(candidateNames)};
  for (const name of _candidates) {
    try {
      if (typeof eval(name) === 'function') {
        _fn = eval(name);
        break;
      }
    } catch {}
  }

  if (!_fn && typeof Solution === 'function') {
    try {
      const sol = new Solution();
      const proto = Object.getPrototypeOf(sol);
      const methods = Object.getOwnPropertyNames(proto).filter(m => m !== 'constructor');
      for (const name of _candidates) {
        if (typeof sol[name] === 'function') {
          _fn = sol[name].bind(sol);
          break;
        }
      }
      if (!_fn && methods.length > 0 && typeof sol[methods[0]] === 'function') {
        _fn = sol[methods[0]].bind(sol);
      }
    } catch {}
  }

  if (!_fn) {
    throw new Error('Could not find solution function. Make sure your function or class Solution is defined according to the problem.');
  }

  const _rawInput = ${JSON.stringify(input)};
  const _lines = _rawInput.trim().split(/\\r?\\n/).filter(l => l.length > 0);
  const _args = _lines.map(line => {
    try { return JSON.parse(line); } catch (e) { return line; }
  });

  let _res = _fn(..._args);
  if (_res === undefined && _args.length > 0 && typeof _args[0] === 'object' && _args[0] !== null) {
    _res = _args[0];
  }

  if (_userLogs.length > 0) {
    process.stdout.write('__LEETCODE_STDOUT__:' + JSON.stringify(_userLogs.join('\\n')) + '\\n');
  }
  process.stdout.write('__LEETCODE_RESULT__:' + JSON.stringify(_res === undefined ? null : _res) + '\\n');
} catch (err) {
  if (_userLogs.length > 0) {
    process.stdout.write('__LEETCODE_STDOUT__:' + JSON.stringify(_userLogs.join('\\n')) + '\\n');
  }
  process.stderr.write((err && err.stack) ? err.stack : String(err));
  process.exit(1);
}
`;
    return { code: harness, stdin: input, isFunctionBased: true };
  }

  // 2. Python Harness
  if (lang === 'python') {
    const harness = `
# ─── Collab Code LeetCode Test Harness ───
from typing import *
import sys, json, os, math, collections, heapq, bisect, itertools, functools, random, re, traceback

_user_logs = []
class _LogCapture:
    def write(self, s):
        if s:
            _user_logs.append(s)
    def flush(self):
        pass

_orig_stdout = sys.stdout
sys.stdout = _LogCapture()

# User code:
${code}

try:
    _fn = None
    _candidates = ${JSON.stringify(candidateNames)}
    for name in _candidates:
        if name in locals() and callable(locals()[name]):
            _fn = locals()[name]
            break

    if not _fn and 'Solution' in locals() and isinstance(locals()['Solution'], type):
        sol = locals()['Solution']()
        for name in _candidates:
            if hasattr(sol, name) and callable(getattr(sol, name)):
                _fn = getattr(sol, name)
                break
        if not _fn:
            for attr in dir(sol):
                if not attr.startswith('_') and callable(getattr(sol, attr)):
                    _fn = getattr(sol, attr)
                    break

    if not _fn:
        raise Exception('Could not find solution function. Make sure your function or class Solution is defined according to the problem.')

    _raw_input = ${JSON.stringify(input)}
    _lines = [l for l in _raw_input.strip().split('\\n') if l.strip()]
    _args = []
    for l in _lines:
        try:
            _args.append(json.loads(l.replace("'", '"')))
        except Exception:
            _args.append(l)

    _res = _fn(*_args)
    if _res is None and len(_args) > 0 and isinstance(_args[0], (list, dict)):
        _res = _args[0]

    sys.stdout = _orig_stdout
    user_out = "".join(_user_logs).strip()

    if user_out:
        print('__LEETCODE_STDOUT__:' + json.dumps(user_out))
    print('__LEETCODE_RESULT__:' + json.dumps(_res))
except Exception as e:
    sys.stdout = _orig_stdout
    user_out = "".join(_user_logs).strip()
    if user_out:
        print('__LEETCODE_STDOUT__:' + json.dumps(user_out))
    sys.stderr.write(traceback.format_exc())
    sys.exit(1)
`;
    return { code: harness, stdin: input, isFunctionBased: true };
  }

  // 3. C++ Harness
  if (lang === 'cpp' || lang === 'c++') {
    const normSlug = (problemSlug || '').toLowerCase().replace(/_/g, '-');
    let prob = normSlug;
    if (!prob || prob === 'custom' || prob === 'code') {
      if (code.includes('twoSum') || code.includes('two_sum')) prob = 'two-sum';
      else if (code.includes('reverseString') || code.includes('reverse_string')) prob = 'reverse-string';
      else if (code.includes('search') || code.includes('binarySearch')) prob = 'binary-search';
      else if (code.includes('isValid') || code.includes('is_valid')) prob = 'valid-parentheses';
      else if (code.includes('maxSubArray') || code.includes('max_sub_array')) prob = 'maximum-subarray';
    }

    let driver = '';

    if (prob === 'two-sum') {
      driver = `
int main() {
    string line1, line2;
    if (!getline(cin, line1)) return 0;
    getline(cin, line2);

    vector<int> nums;
    string cleaned;
    for (char c : line1) {
        if (c == '[' || c == ']' || c == ',') cleaned += ' ';
        else cleaned += c;
    }
    stringstream ss(cleaned);
    int val;
    while (ss >> val) nums.push_back(val);

    int target = 0;
    if (!line2.empty()) {
        stringstream ss2(line2);
        ss2 >> target;
    }

    vector<int> res;
    #if defined(HAS_SOLUTION_CLASS)
    Solution sol;
    res = sol.twoSum(nums, target);
    #else
    res = twoSum(nums, target);
    #endif

    cout << "__LEETCODE_RESULT__:[";
    for (size_t i = 0; i < res.size(); i++) {
        cout << res[i] << (i + 1 < res.size() ? "," : "");
    }
    cout << "]" << endl;
    return 0;
}
`;
    } else if (prob === 'reverse-string') {
      driver = `
int main() {
    string s;
    if (!getline(cin, s)) return 0;
    string res;
    #if defined(HAS_SOLUTION_CLASS)
    Solution sol;
    res = sol.reverseString(s);
    #else
    res = reverseString(s);
    #endif
    cout << "__LEETCODE_RESULT__:\\"" << res << "\\"" << endl;
    return 0;
}
`;
    } else if (prob === 'binary-search') {
      driver = `
int main() {
    string line1, line2;
    if (!getline(cin, line1)) return 0;
    getline(cin, line2);

    vector<int> nums;
    string cleaned;
    for (char c : line1) {
        if (c == '[' || c == ']' || c == ',') cleaned += ' ';
        else cleaned += c;
    }
    stringstream ss(cleaned);
    int val;
    while (ss >> val) nums.push_back(val);

    int target = 0;
    if (!line2.empty()) {
        stringstream ss2(line2);
        ss2 >> target;
    }

    int res = 0;
    #if defined(HAS_SOLUTION_CLASS)
    Solution sol;
    res = sol.search(nums, target);
    #else
    res = search(nums, target);
    #endif

    cout << "__LEETCODE_RESULT__:" << res << endl;
    return 0;
}
`;
    } else if (prob === 'valid-parentheses') {
      driver = `
int main() {
    string s;
    if (!getline(cin, s)) return 0;
    if (s.front() == '"' && s.back() == '"') s = s.substr(1, s.size() - 2);
    bool res = false;
    #if defined(HAS_SOLUTION_CLASS)
    Solution sol;
    res = sol.isValid(s);
    #else
    res = isValid(s);
    #endif
    cout << "__LEETCODE_RESULT__:" << (res ? "true" : "false") << endl;
    return 0;
}
`;
    } else if (prob === 'maximum-subarray') {
      driver = `
int main() {
    string line1;
    if (!getline(cin, line1)) return 0;
    vector<int> nums;
    string cleaned;
    for (char c : line1) {
        if (c == '[' || c == ']' || c == ',') cleaned += ' ';
        else cleaned += c;
    }
    stringstream ss(cleaned);
    int val;
    while (ss >> val) nums.push_back(val);

    int res = 0;
    #if defined(HAS_SOLUTION_CLASS)
    Solution sol;
    res = sol.maxSubArray(nums);
    #else
    res = maxSubArray(nums);
    #endif
    cout << "__LEETCODE_RESULT__:" << res << endl;
    return 0;
}
`;
    } else {
      // Standard I/O fallback
      return { code, stdin: input, isFunctionBased: false };
    }

    const classCheck = code.includes('class Solution') ? '#define HAS_SOLUTION_CLASS 1\n' : '';
    const fullCode = `#include <iostream>\n#include <vector>\n#include <string>\n#include <sstream>\n#include <unordered_map>\n#include <map>\n#include <unordered_set>\n#include <set>\n#include <algorithm>\n#include <stack>\n#include <queue>\n#include <numeric>\n#include <cmath>\n#include <climits>\nusing namespace std;\n${classCheck}\n${code}\n${driver}`;
    return { code: fullCode, stdin: input, isFunctionBased: true };
  }

  // 4. Java Universal Reflection Test Harness
  if (lang === 'java') {
    let normalizedCode = code;
    if (!/class\s+Solution/.test(normalizedCode)) {
      normalizedCode = `class Solution {\n${normalizedCode}\n}`;
    } else {
      normalizedCode = normalizedCode.replace(/public\s+class\s+Solution/g, 'class Solution');
    }

    const listNodeDef = !code.includes('class ListNode')
      ? `class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}`
      : '';

    const treeNodeDef = !code.includes('class TreeNode')
      ? `class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) {
        this.val = val;
        this.left = left;
        this.right = right;
    }
}`
      : '';

    const candidateJavaArray = 'new String[] {' + candidateNames.map(c => JSON.stringify(c)).join(', ') + '}';
    const fullJavaCode = `
import java.util.*;
import java.io.*;
import java.math.*;
import java.lang.reflect.*;

// Common LeetCode Data Structures
${listNodeDef}
${treeNodeDef}

${normalizedCode}

public class Main {
    public static void main(String[] args) {
        try {
            BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
            List<String> rawTokens = new ArrayList<>();
            String line;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (!line.isEmpty()) {
                    rawTokens.add(line);
                }
            }

            Solution sol = new Solution();
            Method[] methods = Solution.class.getDeclaredMethods();
            String[] candidateNames = ${candidateJavaArray};
            List<Method> publicMethods = new ArrayList<>();
            for (Method m : methods) {
                if (Modifier.isPublic(m.getModifiers()) && !m.isSynthetic() && !m.isBridge()) {
                    publicMethods.add(m);
                }
            }
            if (publicMethods.isEmpty()) {
                System.err.println("Error: Could not find any public method in Solution class.");
                System.exit(1);
            }

            Method target = null;
            // 1. Exact match with candidateNames
            for (String cand : candidateNames) {
                for (Method m : publicMethods) {
                    if (m.getName().equalsIgnoreCase(cand)) {
                        target = m;
                        break;
                    }
                }
                if (target != null) break;
            }

            // 2. Match by parameter count excluding helper names
            if (target == null) {
                List<String> helpers = Arrays.asList("fun", "helper", "solve", "dfs", "bfs", "backtrack", "recurse", "traverse", "f");
                for (Method m : publicMethods) {
                    if (!helpers.contains(m.getName().toLowerCase()) && m.getParameterCount() == rawTokens.size()) {
                        target = m;
                        break;
                    }
                }
            }

            // 3. Fallback: Any public method not named in helpers
            if (target == null) {
                List<String> helpers = Arrays.asList("fun", "helper", "solve", "dfs", "bfs", "backtrack", "recurse", "traverse", "f");
                for (Method m : publicMethods) {
                    if (!helpers.contains(m.getName().toLowerCase())) {
                        target = m;
                        break;
                    }
                }
            }

            // 4. Fallback: First public method
            if (target == null) {
                target = publicMethods.get(0);
            }

            Class<?>[] paramTypes = target.getParameterTypes();
            Object[] invokeArgs = new Object[paramTypes.length];
            for (int i = 0; i < paramTypes.length; i++) {
                String token = (i < rawTokens.size()) ? rawTokens.get(i) : "";
                invokeArgs[i] = parseParam(token, paramTypes[i]);
            }

            target.setAccessible(true);
            Object res = null;
            try {
                res = target.invoke(sol, invokeArgs);
            } catch (InvocationTargetException ite) {
                Throwable cause = ite.getCause() != null ? ite.getCause() : ite;
                cause.printStackTrace(System.err);
                System.exit(1);
            }

            if (target.getReturnType() == void.class) {
                res = (invokeArgs.length > 0) ? invokeArgs[0] : null;
            }

            if (res == null && (target.getReturnType().getSimpleName().equals("ListNode") || target.getReturnType().getSimpleName().equals("TreeNode"))) {
                System.out.println("__LEETCODE_RESULT__:[]");
            } else {
                System.out.println("__LEETCODE_RESULT__:" + toJson(res));
            }
        } catch (Throwable t) {
            t.printStackTrace(System.err);
            System.exit(1);
        }
    }

    private static Object parseParam(String s, Class<?> type) {
        if (s == null) s = "";
        s = s.trim();
        int eqIdx = s.indexOf('=');
        if (eqIdx != -1) {
            String beforeEq = s.substring(0, eqIdx).trim();
            if (beforeEq.matches("^[a-zA-Z_][a-zA-Z0-9_]*$")) {
                s = s.substring(eqIdx + 1).trim();
            }
        }

        if (type.getSimpleName().equals("ListNode")) {
            List<String> items = splitArray(s);
            if (items.isEmpty()) return null;
            ListNode dummy = new ListNode(0);
            ListNode curr = dummy;
            for (String item : items) {
                String clean = item.replaceAll("[^0-9-]", "");
                if (!clean.isEmpty()) {
                    curr.next = new ListNode(Integer.parseInt(clean));
                    curr = curr.next;
                }
            }
            return dummy.next;
        }

        if (type.getSimpleName().equals("TreeNode")) {
            List<String> items = splitArray(s);
            if (items.isEmpty() || items.get(0).equals("null")) return null;
            String rootClean = items.get(0).replaceAll("[^0-9-]", "");
            if (rootClean.isEmpty()) return null;
            TreeNode root = new TreeNode(Integer.parseInt(rootClean));
            Queue<TreeNode> queue = new LinkedList<>();
            queue.add(root);
            int idx = 1;
            while (!queue.isEmpty() && idx < items.size()) {
                TreeNode parent = queue.poll();
                if (idx < items.size()) {
                    String leftStr = items.get(idx++).trim();
                    if (!leftStr.equals("null") && !leftStr.isEmpty()) {
                        String clean = leftStr.replaceAll("[^0-9-]", "");
                        if (!clean.isEmpty()) {
                            parent.left = new TreeNode(Integer.parseInt(clean));
                            queue.add(parent.left);
                        }
                    }
                }
                if (idx < items.size()) {
                    String rightStr = items.get(idx++).trim();
                    if (!rightStr.equals("null") && !rightStr.isEmpty()) {
                        String clean = rightStr.replaceAll("[^0-9-]", "");
                        if (!clean.isEmpty()) {
                            parent.right = new TreeNode(Integer.parseInt(clean));
                            queue.add(parent.right);
                        }
                    }
                }
            }
            return root;
        }

        if (type == int.class || type == Integer.class) {
            String clean = s.replaceAll("[^0-9-]", "");
            return clean.isEmpty() ? 0 : Integer.parseInt(clean);
        }
        if (type == long.class || type == Long.class) {
            String clean = s.replaceAll("[^0-9-]", "");
            return clean.isEmpty() ? 0L : Long.parseLong(clean);
        }
        if (type == double.class || type == Double.class) {
            String clean = s.replaceAll("[^0-9.-]", "");
            return clean.isEmpty() ? 0.0 : Double.parseDouble(clean);
        }
        if (type == boolean.class || type == Boolean.class) {
            return s.equalsIgnoreCase("true") || s.equals("1");
        }
        if (type == char.class || type == Character.class) {
            String unq = stripQuotes(s);
            return unq.isEmpty() ? ' ' : unq.charAt(0);
        }
        if (type == String.class) {
            return stripQuotes(s);
        }
        if (type == int[].class) {
            List<String> items = splitArray(s);
            int[] arr = new int[items.size()];
            for (int i = 0; i < items.size(); i++) {
                String clean = items.get(i).replaceAll("[^0-9-]", "");
                arr[i] = clean.isEmpty() ? 0 : Integer.parseInt(clean);
            }
            return arr;
        }
        if (type == char[].class) {
            if (s.startsWith("[") && s.endsWith("]")) {
                List<String> items = splitArray(s);
                char[] arr = new char[items.size()];
                for (int i = 0; i < items.size(); i++) {
                    String unq = stripQuotes(items.get(i));
                    arr[i] = unq.isEmpty() ? ' ' : unq.charAt(0);
                }
                return arr;
            } else {
                return stripQuotes(s).toCharArray();
            }
        }
        if (type == String[].class) {
            List<String> items = splitArray(s);
            String[] arr = new String[items.size()];
            for (int i = 0; i < items.size(); i++) {
                arr[i] = stripQuotes(items.get(i));
            }
            return arr;
        }
        if (type == int[][].class) {
            List<String> rows = splitArray(s);
            int[][] mat = new int[rows.size()][];
            for (int i = 0; i < rows.size(); i++) {
                mat[i] = (int[]) parseParam(rows.get(i), int[].class);
            }
            return mat;
        }
        if (List.class.isAssignableFrom(type)) {
            List<String> items = splitArray(s);
            List<Object> list = new ArrayList<>();
            for (String item : items) {
                if (item.trim().startsWith("[")) {
                    list.add(parseParam(item, List.class));
                } else {
                    String clean = item.replaceAll("[^0-9-]", "");
                    if (!clean.isEmpty()) {
                        list.add(Integer.parseInt(clean));
                    } else {
                        list.add(stripQuotes(item));
                    }
                }
            }
            return list;
        }
        return s;
    }

    private static String stripQuotes(String str) {
        str = str.trim();
        if (str.length() >= 2 && ((str.startsWith("\\"") && str.endsWith("\\"")) || (str.startsWith("'") && str.endsWith("'")))) {
            return str.substring(1, str.length() - 1);
        }
        return str;
    }

    private static List<String> splitArray(String s) {
        List<String> list = new ArrayList<>();
        s = s.trim();
        if (s.startsWith("[")) s = s.substring(1);
        if (s.endsWith("]")) s = s.substring(0, s.length() - 1);
        s = s.trim();
        if (s.isEmpty()) return list;

        int depth = 0;
        boolean inQuotes = false;
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' && (i == 0 || s.charAt(i - 1) != '\\\\')) {
                inQuotes = !inQuotes;
                current.append(c);
            } else if (!inQuotes && (c == '[' || c == '{')) {
                depth++;
                current.append(c);
            } else if (!inQuotes && (c == ']' || c == '}')) {
                depth--;
                current.append(c);
            } else if (!inQuotes && depth == 0 && (c == ',' || (c == ' ' && current.length() > 0 && !s.contains(",")))) {
                if (current.length() > 0) {
                    list.add(current.toString().trim());
                    current.setLength(0);
                }
            } else {
                current.append(c);
            }
        }
        if (current.length() > 0 && !current.toString().trim().isEmpty()) {
            list.add(current.toString().trim());
        }
        return list;
    }

    private static String toJson(Object obj) {
        if (obj == null) return "null";
        if (obj.getClass().getSimpleName().equals("ListNode")) {
            StringBuilder sb = new StringBuilder("[");
            Object curr = obj;
            boolean first = true;
            while (curr != null) {
                try {
                    Field valField = curr.getClass().getDeclaredField("val");
                    valField.setAccessible(true);
                    Field nextField = curr.getClass().getDeclaredField("next");
                    nextField.setAccessible(true);
                    if (!first) sb.append(",");
                    sb.append(valField.get(curr));
                    curr = nextField.get(curr);
                    first = false;
                } catch (Exception e) {
                    break;
                }
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj.getClass().getSimpleName().equals("TreeNode")) {
            List<String> list = new ArrayList<>();
            Queue<Object> q = new LinkedList<>();
            q.add(obj);
            while (!q.isEmpty()) {
                Object node = q.poll();
                if (node == null) {
                    list.add("null");
                } else {
                    try {
                        Field valField = node.getClass().getDeclaredField("val");
                        valField.setAccessible(true);
                        Field leftField = node.getClass().getDeclaredField("left");
                        leftField.setAccessible(true);
                        Field rightField = node.getClass().getDeclaredField("right");
                        rightField.setAccessible(true);
                        list.add(String.valueOf(valField.get(node)));
                        q.add(leftField.get(node));
                        q.add(rightField.get(node));
                    } catch (Exception e) {
                        break;
                    }
                }
            }
            while (!list.isEmpty() && list.get(list.size() - 1).equals("null")) {
                list.remove(list.size() - 1);
            }
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < list.size(); i++) {
                sb.append(list.get(i));
                if (i + 1 < list.size()) sb.append(",");
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj instanceof String) {
            return "\\"" + ((String) obj).replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"").replace("\\n", "\\\\\\n").replace("\\r", "\\\\\\r") + "\\"";
        }
        if (obj instanceof Character) {
            return "\\"" + obj + "\\"";
        }
        if (obj instanceof Number || obj instanceof Boolean) {
            return String.valueOf(obj);
        }
        if (obj instanceof char[]) {
            return "\\"" + new String((char[]) obj).replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") + "\\"";
        }
        if (obj instanceof int[]) {
            int[] arr = (int[]) obj;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < arr.length; i++) {
                sb.append(arr[i]);
                if (i + 1 < arr.length) sb.append(",");
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj instanceof long[]) {
            long[] arr = (long[]) obj;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < arr.length; i++) {
                sb.append(arr[i]);
                if (i + 1 < arr.length) sb.append(",");
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj instanceof double[]) {
            double[] arr = (double[]) obj;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < arr.length; i++) {
                sb.append(arr[i]);
                if (i + 1 < arr.length) sb.append(",");
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj instanceof boolean[]) {
            boolean[] arr = (boolean[]) obj;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < arr.length; i++) {
                sb.append(arr[i]);
                if (i + 1 < arr.length) sb.append(",");
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj instanceof Object[]) {
            Object[] arr = (Object[]) obj;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < arr.length; i++) {
                sb.append(toJson(arr[i]));
                if (i + 1 < arr.length) sb.append(",");
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj instanceof Collection<?>) {
            Collection<?> col = (Collection<?>) obj;
            StringBuilder sb = new StringBuilder("[");
            int i = 0;
            for (Object item : col) {
                sb.append(toJson(item));
                if (++i < col.size()) sb.append(",");
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj instanceof Map<?, ?>) {
            Map<?, ?> map = (Map<?, ?>) obj;
            StringBuilder sb = new StringBuilder("{");
            int i = 0;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                sb.append(toJson(String.valueOf(entry.getKey()))).append(":").append(toJson(entry.getValue()));
                if (++i < map.size()) sb.append(",");
            }
            sb.append("}");
            return sb.toString();
        }
        return "\\"" + obj.toString() + "\\"";
    }
}
`;
    return { code: fullJavaCode, stdin: input, isFunctionBased: true };
  }

  return { code, stdin: input, isFunctionBased: false };
}

// ─── Test Suite Evaluation Engine ─────────────────────────────

export interface EvaluationOptions {
  stopOnFirstFailure?: boolean;
  timeoutMsPerCase?: number;
}

/**
 * Evaluates submitted code against a test-case suite.
 * Features:
 * - Single upfront compilation for compiled languages (Java, C++).
 * - Fast path on Compilation Error without running test cases.
 * - Accurate separation of Stdout vs Result.
 * - Rigorous output comparison (exact, structured, token, float).
 * - Early stop on timeout or critical judge error.
 */
export async function evaluateTestCases(
  code: string,
  language: string,
  testCases: TestCaseItem[],
  problemSlug?: string,
  options?: EvaluationOptions
): Promise<TestSuiteEvaluationResult> {
  const startTime = Date.now();
  const testResults: TestCaseEvaluationItem[] = [];
  let allPassed = true;
  let overallStatus: Verdict = 'accepted';
  let topCompilerError: string | undefined;
  let topRuntimeError: string | undefined;

  if (!testCases || testCases.length === 0) {
    return {
      allPassed: false,
      totalCases: 0,
      passedCases: 0,
      status: 'judge_error',
      testResults: [],
      totalTimeMs: 0,
      compilerError: 'No test cases provided for evaluation.',
    };
  }

  const lang = language.toLowerCase();
  const timeoutMs = options?.timeoutMsPerCase || 6000;

  // ─── Check Single Upfront Compilation for C++ / Java ────────
  // We can verify compilation immediately with a sample harness test
  if (lang === 'cpp' || lang === 'c++' || lang === 'java') {
    const probe = buildTestHarness(code, language, testCases[0]?.input || '', problemSlug);
    const compileCheck = await executeCode({
      code: probe.code,
      language,
      stdin: probe.stdin,
      timeoutMs: 12000,
    });

    if (compileCheck.status === 'compile_error') {
      topCompilerError = compileCheck.stderr || 'Compilation error occurred.';
      return {
        allPassed: false,
        totalCases: testCases.length,
        passedCases: 0,
        status: 'compile_error',
        testResults: [
          {
            index: 1,
            input: testCases[0]?.input || '',
            expectedOutput: testCases[0]?.expectedOutput || '',
            actualOutput: 'Compilation Error',
            passed: false,
            status: 'compile_error',
            executionTimeMs: compileCheck.executionTimeMs,
            stderr: compileCheck.stderr,
            errorMessage: compileCheck.stderr,
          },
        ],
        totalTimeMs: Date.now() - startTime,
        compilerError: topCompilerError,
      };
    }
  }

  // ─── Execute Test Cases ─────────────────────────────────────
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const { code: executableCode, stdin, isFunctionBased } = buildTestHarness(code, language, tc.input, problemSlug);

    const execResult = await executeCode({
      code: executableCode,
      language,
      stdin,
      timeoutMs,
    });

    // 1. Compilation Error
    if (execResult.status === 'compile_error') {
      overallStatus = 'compile_error';
      allPassed = false;
      topCompilerError = execResult.stderr || 'Compilation error occurred.';
      testResults.push({
        index: i + 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput || '',
        actualOutput: 'Compilation Error',
        passed: false,
        status: 'compile_error',
        executionTimeMs: execResult.executionTimeMs,
        stderr: execResult.stderr,
        errorMessage: execResult.stderr || 'Syntax or compilation error',
      });
      break;
    }

    // 2. Timeout (Time Limit Exceeded)
    if (execResult.status === 'timeout') {
      overallStatus = 'time_limit';
      allPassed = false;
      testResults.push({
        index: i + 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput || '',
        actualOutput: 'Time Limit Exceeded',
        passed: false,
        status: 'timeout',
        executionTimeMs: execResult.executionTimeMs,
        stderr: execResult.stderr,
        errorMessage: `Execution exceeded time limit (${timeoutMs}ms)`,
      });
      if (options?.stopOnFirstFailure) break;
      continue;
    }

    // 3. Output Limit Exceeded
    if (execResult.status === 'output_limit_exceeded') {
      overallStatus = 'output_limit';
      allPassed = false;
      testResults.push({
        index: i + 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput || '',
        actualOutput: 'Output Limit Exceeded',
        passed: false,
        status: 'output_limit',
        executionTimeMs: execResult.executionTimeMs,
        stderr: execResult.stderr,
        errorMessage: 'Output limit exceeded (max 512KB)',
      });
      if (options?.stopOnFirstFailure) break;
      continue;
    }

    // 4. Runtime Error
    if (execResult.status === 'error' || (execResult.exitCode !== 0 && !execResult.stdout.includes('__LEETCODE_RESULT__:'))) {
      if (overallStatus === 'accepted') overallStatus = 'runtime_error';
      allPassed = false;
      topRuntimeError = execResult.stderr || 'Runtime error occurred.';
      testResults.push({
        index: i + 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput || '',
        actualOutput: 'Runtime Error',
        passed: false,
        status: 'runtime_error',
        executionTimeMs: execResult.executionTimeMs,
        stderr: execResult.stderr,
        errorMessage: execResult.stderr || 'Runtime exception',
      });
      if (options?.stopOnFirstFailure) break;
      continue;
    }

    // 5. Extract Result & Stdout
    let actualOutput = '';
    let userStdout = '';
    const rawStdout = execResult.stdout;

    const resultMarker = '__LEETCODE_RESULT__:';
    const stdoutMarker = '__LEETCODE_STDOUT__:';

    if (rawStdout.includes(stdoutMarker)) {
      const parts = rawStdout.split(stdoutMarker);
      const afterMarker = parts[1].split('\n')[0];
      try {
        userStdout = JSON.parse(afterMarker);
      } catch {
        userStdout = afterMarker;
      }
    }

    if (rawStdout.includes(resultMarker)) {
      const parts = rawStdout.split(resultMarker);
      actualOutput = parts[1].split('\n')[0].trim();
    } else {
      actualOutput = rawStdout.trim();
    }

    // If custom test case without expected output (Run Code with custom input):
    const isCustomRun = tc.expectedOutput === undefined || tc.expectedOutput === null || tc.expectedOutput === '';

    let passed = false;
    if (isCustomRun) {
      // In custom run mode, execution succeeded without error
      passed = true;
    } else {
      passed = compareOutputs(actualOutput, tc.expectedOutput, problemSlug, {
        policy: isFunctionBased ? 'structured' : 'exact',
      });
    }

    if (!passed && !isCustomRun) {
      allPassed = false;
      if (overallStatus === 'accepted') {
        overallStatus = 'wrong_answer';
      }
    }

    testResults.push({
      index: i + 1,
      input: tc.input,
      expectedOutput: tc.expectedOutput || '',
      actualOutput: actualOutput || '(No output)',
      userStdout: userStdout || undefined,
      passed,
      status: isCustomRun ? 'executed' : passed ? 'passed' : 'wrong_answer',
      executionTimeMs: execResult.executionTimeMs,
      stderr: execResult.stderr || undefined,
    });

    if (!passed && !isCustomRun && options?.stopOnFirstFailure) {
      break;
    }
  }

  const passedCases = testResults.filter((r) => r.passed && r.status !== 'executed').length;

  return {
    allPassed,
    totalCases: testCases.length,
    passedCases,
    status: overallStatus,
    testResults,
    totalTimeMs: Date.now() - startTime,
    compilerError: topCompilerError,
    runtimeError: topRuntimeError,
  };
}
