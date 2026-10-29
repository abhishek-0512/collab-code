/**
 * docker-smoke-test.ts
 *
 * Comprehensive Docker-based language smoke tests.
 * Run with: DOCKER_EXECUTION=true npx tsx server/scripts/docker-smoke-test.ts
 *
 * Tests per language:
 *   JavaScript : success, syntax-error, runtime-error, stdin, infinite-loop, excessive-stdout, excessive-stderr
 *   TypeScript : success, runtime-error, stdin
 *   Python     : success, syntax-error, runtime-error, stdin, excessive-output
 *   Java       : success, compile-error, runtime-error, stdin
 *   C++        : success, compile-error, runtime-error, stdin
 *
 * Combined output limit and timeout are verified.
 *
 * NOTE on TypeScript type errors:
 *   tsx is a pure transpiler — it intentionally does NOT enforce TypeScript type
 *   errors at runtime (it strips them). Compile-time type checking requires a
 *   separate `tsc --noEmit` step. The runner therefore cannot distinguish a
 *   type-only error from valid code and will execute both successfully. This is
 *   documented expected behaviour.
 */

process.env.DOCKER_EXECUTION = 'true';

import type { ExecutionResult } from '../src/services/execution.service';
import { executeLocally } from '../src/services/execution.service';

// ─── Colour helpers ──────────────────────────────────────────────────────────

const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;

// ─── Test framework ──────────────────────────────────────────────────────────

interface TestCase {
  name:       string;
  language:   string;
  code:       string;
  stdin?:     string;
  timeoutMs?: number;
  /** Return null on pass, or a failure description string. */
  expect: (r: ExecutionResult) => string | null;
}

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function run(tc: TestCase): Promise<void> {
  const start = Date.now();
  try {
    const result = await executeLocally({
      code:      tc.code,
      language:  tc.language,
      stdin:     tc.stdin,
      timeoutMs: tc.timeoutMs ?? 8000,
    });
    const failure = tc.expect(result);
    const elapsed = Date.now() - start;
    if (failure === null) {
      console.log(`  ${green('✔')} ${tc.name} (${elapsed} ms)`);
      passed++;
    } else {
      console.log(`  ${red('✘')} ${tc.name} (${elapsed} ms)`);
      console.log(`      ${red('reason:')} ${failure}`);
      console.log(`      status=${yellow(result.status)}  exit=${result.exitCode}`);
      if (result.stdout) console.log(`      stdout: ${result.stdout.slice(0, 200)}`);
      if (result.stderr) console.log(`      stderr: ${result.stderr.slice(0, 300)}`);
      failed++;
      failures.push(`[${tc.language}] ${tc.name}: ${failure}`);
    }
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`  ${red('✘')} ${tc.name} (${elapsed} ms) — THREW: ${err}`);
    failed++;
    failures.push(`[${tc.language}] ${tc.name}: threw ${err}`);
  }
}

function section(title: string): void {
  console.log(`\n${bold(title)}`);
}

// ─── Test definitions ─────────────────────────────────────────────────────────

const tests: TestCase[] = [

  // ─── JavaScript ────────────────────────────────────────────────────────────

  {
    name: 'JavaScript: success',
    language: 'javascript',
    code: 'console.log("hello docker");',
    expect: r => r.status === 'success' && r.stdout.includes('hello docker')
      ? null : `expected status=success stdout includes "hello docker", got status=${r.status} stdout="${r.stdout}"`,
  },
  {
    name: 'JavaScript: syntax error → compile_error',
    language: 'javascript',
    code: 'const x = ;',
    expect: r => r.status === 'compile_error'
      ? null : `expected compile_error, got ${r.status}`,
  },
  {
    name: 'JavaScript: runtime exception → error',
    language: 'javascript',
    code: 'null.foo();',
    expect: r => ['error', 'runtime_error'].includes(r.status) && r.exitCode !== 0
      ? null : `expected error/runtime_error, got ${r.status}`,
  },
  {
    name: 'JavaScript: stdin',
    language: 'javascript',
    // Use a simpler stdin approach: read all of stdin then print it
    code: `
process.stdin.setEncoding('utf8');
let data = '';
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => { console.log('got:' + data.trim()); });
`,
    stdin: 'world\n',
    expect: r => r.status === 'success' && r.stdout.includes('got:world')
      ? null : `expected stdout includes "got:world", got status=${r.status} stdout="${r.stdout}"`,
  },
  {
    name: 'JavaScript: infinite loop → timeout',
    language: 'javascript',
    code: 'while (true) {}',
    timeoutMs: 2000,
    expect: r => r.status === 'timeout'
      ? null : `expected timeout, got ${r.status}`,
  },
  {
    name: 'JavaScript: excessive stdout → output_limit_exceeded',
    language: 'javascript',
    code: `
// Write 600KB in small 4KB chunks with small delays to ensure pipe flow.
const chunk = Buffer.allocUnsafe(4096).fill(120); // 'x'
let written = 0;
function write() {
  while (process.stdout.write(chunk)) {
    written += chunk.length;
    if (written > 600 * 1024) return;
  }
  if (written <= 600 * 1024) {
    process.stdout.once('drain', write);
  }
}
write();
`,
    timeoutMs: 15000,
    expect: r => r.status === 'output_limit_exceeded'
      ? null : `expected output_limit_exceeded, got ${r.status}`,
  },
  {
    name: 'JavaScript: excessive stderr → output_limit_exceeded (combined budget fix)',
    language: 'javascript',
    code: `
// Write 600KB to stderr to trigger the combined budget.
const chunk = Buffer.allocUnsafe(4096).fill(101); // 'e'
let written = 0;
function write() {
  while (process.stderr.write(chunk)) {
    written += chunk.length;
    if (written > 600 * 1024) return;
  }
  if (written <= 600 * 1024) {
    process.stderr.once('drain', write);
  }
}
write();
`,
    timeoutMs: 15000,
    expect: r => r.status === 'output_limit_exceeded'
      ? null : `expected output_limit_exceeded from stderr flood (combined budget), got ${r.status}`,
  },

  // ─── TypeScript ────────────────────────────────────────────────────────────
  // NOTE: tsx is a transpiler only — type errors are NOT enforced at runtime.
  // A test for compile-time type errors is omitted here; use `tsc --noEmit`
  // in the CI pipeline for type checking.

  {
    name: 'TypeScript: success',
    language: 'typescript',
    code: `
const greet = (name: string): string => \`hello \${name}\`;
console.log(greet('typescript'));
`,
    expect: r => r.status === 'success' && r.stdout.includes('hello typescript')
      ? null : `expected success with "hello typescript", got ${r.status} "${r.stdout}"`,
  },
  {
    name: 'TypeScript: runtime exception',
    language: 'typescript',
    code: `(null as any).toString();`,
    expect: r => ['error', 'runtime_error'].includes(r.status) && r.exitCode !== 0
      ? null : `expected runtime error, got ${r.status}`,
  },
  {
    name: 'TypeScript: stdin',
    language: 'typescript',
    code: `
process.stdin.setEncoding('utf8');
let data = '';
process.stdin.on('data', (chunk: string) => { data += chunk; });
process.stdin.on('end', () => { console.log('ts:' + data.trim()); });
`,
    stdin: '42\n',
    expect: r => r.status === 'success' && r.stdout.includes('ts:42')
      ? null : `expected ts:42 in stdout, got ${r.status} "${r.stdout}"`,
  },

  // ─── Python ────────────────────────────────────────────────────────────────

  {
    name: 'Python: success',
    language: 'python',
    code: 'print("hello python")',
    expect: r => r.status === 'success' && r.stdout.includes('hello python')
      ? null : `expected success with "hello python", got ${r.status} stderr="${r.stderr?.slice(0,200)}"`,
  },
  {
    name: 'Python: syntax error → compile_error',
    language: 'python',
    code: 'def foo(\n  print("bad")',
    expect: r => r.status === 'compile_error'
      ? null : `expected compile_error, got ${r.status}`,
  },
  {
    name: 'Python: runtime exception',
    language: 'python',
    code: 'x = 1 / 0',
    expect: r => ['error', 'runtime_error'].includes(r.status) && r.exitCode !== 0
      ? null : `expected runtime error, got ${r.status}`,
  },
  {
    name: 'Python: stdin',
    language: 'python',
    code: `
import sys
line = sys.stdin.readline().strip()
print(f"py:{line}")
`,
    stdin: 'hello\n',
    expect: r => r.status === 'success' && r.stdout.includes('py:hello')
      ? null : `expected py:hello, got ${r.status} stdout="${r.stdout}" stderr="${r.stderr?.slice(0,200)}"`,
  },
  {
    name: 'Python: excessive output → output_limit_exceeded',
    language: 'python',
    code: `
import sys
# Write 600KB to trigger combined output limit (512KB threshold).
chunk = b'y' * 4096
written = 0
while written <= 614400:
    n = sys.stdout.buffer.write(chunk)
    sys.stdout.buffer.flush()
    written += n
`,
    timeoutMs: 15000,
    expect: r => r.status === 'output_limit_exceeded'
      ? null : `expected output_limit_exceeded, got ${r.status}`,
  },

  // ─── Java ──────────────────────────────────────────────────────────────────

  {
    name: 'Java: success',
    language: 'java',
    code: `
public class Main {
    public static void main(String[] args) {
        System.out.println("hello java");
    }
}
`,
    expect: r => r.status === 'success' && r.stdout.includes('hello java')
      ? null : `expected success with "hello java", got ${r.status} stderr="${r.stderr?.slice(0,200)}"`,
  },
  {
    name: 'Java: compile error → compile_error',
    language: 'java',
    code: `
public class Main {
    public static void main(String[] args)
        System.out.println("missing brace")
}
`,
    expect: r => r.status === 'compile_error'
      ? null : `expected compile_error, got ${r.status}`,
  },
  {
    name: 'Java: runtime exception',
    language: 'java',
    code: `
public class Main {
    public static void main(String[] args) {
        int[] arr = new int[0];
        System.out.println(arr[5]);
    }
}
`,
    expect: r => ['error', 'runtime_error'].includes(r.status) && r.exitCode !== 0
      ? null : `expected runtime error, got ${r.status}`,
  },
  {
    name: 'Java: stdin',
    language: 'java',
    code: `
import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        String line = sc.nextLine();
        System.out.println("java:" + line);
    }
}
`,
    stdin: 'world\n',
    expect: r => r.status === 'success' && r.stdout.includes('java:world')
      ? null : `expected java:world, got ${r.status} stdout="${r.stdout}" stderr="${r.stderr?.slice(0,200)}"`,
  },

  // ─── C++ ───────────────────────────────────────────────────────────────────

  {
    name: 'C++: success',
    language: 'cpp',
    code: `
#include <iostream>
int main() {
    std::cout << "hello cpp" << std::endl;
    return 0;
}
`,
    expect: r => r.status === 'success' && r.stdout.includes('hello cpp')
      ? null : `expected success with "hello cpp", got ${r.status} stderr="${r.stderr?.slice(0,200)}"`,
  },
  {
    name: 'C++: compile error → compile_error',
    language: 'cpp',
    code: `
#include <iostream>
int main() {
    this is not valid c++;
}
`,
    expect: r => r.status === 'compile_error'
      ? null : `expected compile_error, got ${r.status}`,
  },
  {
    name: 'C++: runtime error (segfault)',
    language: 'cpp',
    code: `
#include <iostream>
int main() {
    int* p = nullptr;
    std::cout << *p << std::endl;
    return 0;
}
`,
    expect: r => ['error', 'runtime_error'].includes(r.status) && r.exitCode !== 0
      ? null : `expected runtime error, got ${r.status}`,
  },
  {
    name: 'C++: stdin',
    language: 'cpp',
    code: `
#include <iostream>
#include <string>
int main() {
    std::string line;
    std::getline(std::cin, line);
    std::cout << "cpp:" << line << std::endl;
    return 0;
}
`,
    stdin: 'hello\n',
    expect: r => r.status === 'success' && r.stdout.includes('cpp:hello')
      ? null : `expected cpp:hello, got ${r.status} stdout="${r.stdout}" stderr="${r.stderr?.slice(0,200)}"`,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(bold('\n╔══════════════════════════════════════════════════════════════╗'));
  console.log(bold('║  Collab Code — Docker Language Smoke Tests                   ║'));
  console.log(bold('╚══════════════════════════════════════════════════════════════╝'));
  console.log(`  Image: ${process.env.DOCKER_EXECUTION_IMAGE || 'collab-code-runner:local'}`);
  console.log(`  Combined output limit: 512 KB`);

  const languages = ['javascript', 'typescript', 'python', 'java', 'cpp'];

  for (const lang of languages) {
    const langTests = tests.filter(t => t.language === lang);
    section(`── ${lang.toUpperCase()} (${langTests.length} tests) ──`);
    for (const t of langTests) {
      await run(t);
    }
  }

  const total = passed + failed;
  console.log(`\n${bold('Results:')} ${green(String(passed))} passed, ${failed > 0 ? red(String(failed)) : String(failed)} failed (${total} total)`);

  if (failures.length > 0) {
    console.log(`\n${red('Failed tests:')}`);
    for (const f of failures) {
      console.log(`  ${red('•')} ${f}`);
    }
    process.exit(1);
  } else {
    console.log(`\n${green('All Docker smoke tests passed.')} ✓`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
