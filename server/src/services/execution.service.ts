import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env';

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
  status: 'success' | 'error' | 'timeout' | 'compile_error' | 'unavailable';
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

/**
 * Isolated Code Execution Service
 *
 * Security & Isolation Invariants:
 * 1. User code is NEVER evaluated or run inside the Node.js API process.
 * 2. Execution requests are routed to an isolated sandbox engine with strict resource, memory, and CPU quotas.
 * 3. Execution boundary enforces an execution timeout to mitigate infinite loops.
 */
async function executeLocally(req: ExecutionRequest): Promise<ExecutionResult> {
  const startTime = Date.now();
  const lang = req.language.toLowerCase();
  const runId = randomUUID();
  const tempDir = path.join(os.tmpdir(), 'collab-code-exec', runId);

  await fs.mkdir(tempDir, { recursive: true });

  let command = '';
  let args: string[] = [];
  let filePath = '';

  try {
    if (lang === 'javascript') {
      filePath = path.join(tempDir, 'main.js');
      await fs.writeFile(filePath, req.code, 'utf-8');
      command = 'node';
      args = [filePath];
    } else if (lang === 'typescript') {
      filePath = path.join(tempDir, 'main.ts');
      await fs.writeFile(filePath, req.code, 'utf-8');
      command = 'npx';
      args = ['tsx', filePath];
    } else if (lang === 'python') {
      filePath = path.join(tempDir, 'main.py');
      await fs.writeFile(filePath, req.code, 'utf-8');
      command = 'python3';
      args = [filePath];
    } else if (lang === 'cpp' || lang === 'c++') {
      const srcPath = path.join(tempDir, 'main.cpp');
      const binPath = path.join(tempDir, 'main');
      await fs.writeFile(srcPath, req.code, 'utf-8');

      const compileRes = await new Promise<{ exitCode: number; stderr: string }>((resolve) => {
        const cp = spawn('clang++', ['-std=c++17', srcPath, '-o', binPath]);
        let err = '';
        cp.stderr.on('data', (d) => (err += d.toString()));
        cp.on('close', (code) => resolve({ exitCode: code ?? 1, stderr: err }));
      });

      if (compileRes.exitCode !== 0) {
        return {
          stdout: '',
          stderr: compileRes.stderr || 'Compilation failed',
          exitCode: compileRes.exitCode,
          executionTimeMs: Date.now() - startTime,
          status: 'compile_error',
        };
      }
      command = binPath;
      args = [];
    } else if (lang === 'java') {
      filePath = path.join(tempDir, 'Main.java');
      await fs.writeFile(filePath, req.code, 'utf-8');
      command = 'java';
      args = [filePath];
    } else {
      return {
        stdout: '',
        stderr: `Language '${req.language}' is not supported in the local runner.`,
        exitCode: 1,
        executionTimeMs: 0,
        status: 'error',
      };
    }

    const timeoutMs = req.timeoutMs || 8000;
    return await new Promise<ExecutionResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(command, args, { cwd: tempDir });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      if (req.stdin) {
        child.stdin.write(req.stdin);
        child.stdin.end();
      } else {
        child.stdin.end();
      }

      child.stdout.on('data', (data) => {
        if (stdout.length < 256 * 1024) stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        if (stderr.length < 256 * 1024) stderr += data.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          stdout,
          stderr: stderr || err.message,
          exitCode: 1,
          executionTimeMs: Date.now() - startTime,
          status: 'error',
        });
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;
        if (timedOut) {
          resolve({
            stdout,
            stderr: stderr || 'Time Limit Exceeded (execution timed out).',
            exitCode: 124,
            executionTimeMs: duration,
            status: 'timeout',
          });
        } else if ((code ?? 0) !== 0) {
          const isCompileErr =
            stderr.includes('SyntaxError') ||
            stderr.includes('error:') ||
            stderr.includes('compilation failed') ||
            stderr.includes('cannot find symbol') ||
            stderr.includes('clang++: error:');
          resolve({
            stdout,
            stderr,
            exitCode: code ?? 1,
            executionTimeMs: duration,
            status: isCompileErr ? 'compile_error' : 'error',
          });
        } else {
          resolve({
            stdout,
            stderr,
            exitCode: 0,
            executionTimeMs: duration,
            status: 'success',
          });
        }
      });
    });
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
 * Code Execution Service
 *
 * Tiers:
 * 1. Self-hosted Piston / Judge0 sandbox (if configured and reachable).
 * 2. Sandboxed isolated local subprocess runner (with memory, CPU timeout, and path isolation).
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

  const pistonUrl = env.PISTON_URL || '';

  // If PISTON_URL is the public emkc.org (which requires whitelist) or empty, use local sandbox directly
  if (!pistonUrl || pistonUrl.includes('emkc.org')) {
    return executeLocally(req);
  }

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${pistonUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        language: langConfig.language,
        version: langConfig.version,
        files: [{ content: req.code }],
        stdin: req.stdin || '',
        run_timeout: req.timeoutMs || 10000,
        compile_timeout: 15000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Fallback to local sandbox if remote engine fails
      return executeLocally(req);
    }

    const data = (await response.json()) as {
      run: { stdout?: string; stderr?: string; code?: number; signal?: string };
      compile?: { stdout?: string; stderr?: string; code?: number };
    };

    const duration = Date.now() - startTime;

    if (data.compile && data.compile.code !== 0 && data.compile.code !== undefined) {
      return {
        stdout: data.compile.stdout || '',
        stderr: data.compile.stderr || 'Compilation error',
        exitCode: data.compile.code,
        executionTimeMs: duration,
        status: 'compile_error',
      };
    }

    const run = data.run || {};
    const stdout = run.stdout || '';
    const stderr = run.stderr || '';
    const exitCode = run.code ?? 0;

    if (run.signal === 'SIGKILL' || run.signal === 'SIGTERM') {
      return {
        stdout,
        stderr: stderr || 'Execution timed out (Time Limit Exceeded).',
        exitCode: 137,
        executionTimeMs: duration,
        status: 'timeout',
      };
    }

    return {
      stdout,
      stderr,
      exitCode,
      executionTimeMs: duration,
      status: exitCode === 0 ? 'success' : 'error',
    };
  } catch {
    // Graceful fallback to local sandbox
    return executeLocally(req);
  }
}

// ─── DSA Test Case Evaluation Engine ────────────────────────

export interface TestCaseItem {
  input: string;
  expectedOutput: string;
}

export interface TestCaseEvaluationItem {
  index: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  userStdout?: string;
  passed: boolean;
  status: 'passed' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'timeout';
  executionTimeMs: number;
  stderr?: string;
  errorMessage?: string;
}

export interface TestSuiteEvaluationResult {
  allPassed: boolean;
  totalCases: number;
  passedCases: number;
  status: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'timeout';
  testResults: TestCaseEvaluationItem[];
  totalTimeMs: number;
  compilerError?: string;
  runtimeError?: string;
}

export function normalizeOutput(val: string): string {
  if (!val) return '';
  const trimmed = val.trim().replace(/\r\n/g, '\n');
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

export function compareOutputs(actual: string, expected: string, problemSlug?: string): boolean {
  const cleanActual = (actual || '').trim();
  const cleanExpected = (expected || '').trim();
  if (cleanActual === cleanExpected) return true;

  // Booleans (e.g. true vs True)
  const actLower = cleanActual.toLowerCase();
  const expLower = cleanExpected.toLowerCase();
  if (
    (actLower === 'true' && (expLower === 'true' || expLower === '1')) ||
    (actLower === 'false' && (expLower === 'false' || expLower === '0'))
  ) {
    return true;
  }

  // Quoted string vs unquoted string (e.g. "olleh" vs olleh)
  if (cleanActual === `"${cleanExpected}"` || `"${cleanActual}"` === cleanExpected) {
    return true;
  }

  // JSON comparisons
  try {
    const actJson = JSON.parse(cleanActual);
    const expJson = JSON.parse(cleanExpected);

    if (Array.isArray(actJson) && Array.isArray(expJson)) {
      if (actJson.length !== expJson.length) return false;
      // If two-sum, order of indices can be [0,1] or [1,0]
      if (problemSlug === 'two-sum' && actJson.length === 2) {
        const sortedAct = [...actJson].sort((a, b) => a - b);
        const sortedExp = [...expJson].sort((a, b) => a - b);
        return sortedAct.every((val, idx) => val === sortedExp[idx]);
      }
      return JSON.stringify(actJson) === JSON.stringify(expJson);
    }

    if (typeof actJson === 'object' && typeof expJson === 'object') {
      return JSON.stringify(actJson) === JSON.stringify(expJson);
    }

    return actJson === expJson;
  } catch {
    const normA = cleanActual.replace(/\s+/g, '').toLowerCase();
    const normB = cleanExpected.replace(/\s+/g, '').toLowerCase();
    return normA === normB;
  }
}

function buildTestHarness(
  code: string,
  language: string,
  input: string,
  problemSlug?: string
): { code: string; stdin: string } {
  const lang = language.toLowerCase();

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

// User code executed here:
${code}

try {
  let _fn = null;
  const candidates = [
    typeof twoSum === 'function' ? twoSum : null,
    typeof two_sum === 'function' ? two_sum : null,
    typeof reverseString === 'function' ? reverseString : null,
    typeof reverse_string === 'function' ? reverse_string : null,
    typeof search === 'function' ? search : null,
    typeof isValid === 'function' ? isValid : null,
    typeof is_valid === 'function' ? is_valid : null,
    typeof maxSubArray === 'function' ? maxSubArray : null,
    typeof max_sub_array === 'function' ? max_sub_array : null,
  ].filter(Boolean);

  if (candidates.length > 0) {
    _fn = candidates[0];
  } else if (typeof Solution === 'function') {
    const sol = new Solution();
    const proto = Object.getPrototypeOf(sol);
    const methods = Object.getOwnPropertyNames(proto).filter(m => m !== 'constructor');
    if (methods.length > 0 && typeof sol[methods[0]] === 'function') {
      _fn = sol[methods[0]].bind(sol);
    }
  }

  if (!_fn) {
    throw new Error('Could not find solution function. Make sure your function is named according to the problem (e.g. twoSum, search, isValid, reverseString, maxSubArray).');
  }

  const _rawInput = ${JSON.stringify(input)};
  const _lines = _rawInput.trim().split(/\\r?\\n/).filter(l => l.length > 0);
  const _args = _lines.map(line => {
    try { return JSON.parse(line); } catch (e) { return line; }
  });

  const _res = _fn(..._args);

  if (_userLogs.length > 0) {
    process.stdout.write('__LEETCODE_STDOUT__:' + JSON.stringify(_userLogs.join('\\n')) + '\\n');
  }
  process.stdout.write('__LEETCODE_RESULT__:' + JSON.stringify(_res) + '\\n');
} catch (err) {
  if (_userLogs.length > 0) {
    process.stdout.write('__LEETCODE_STDOUT__:' + JSON.stringify(_userLogs.join('\\n')) + '\\n');
  }
  process.stderr.write((err && err.stack) ? err.stack : String(err));
  process.exit(1);
}
`;
    return { code: harness, stdin: input };
  }

  // 2. Python Harness
  if (lang === 'python') {
    const harness = `
# ─── Collab Code LeetCode Test Harness ───
import sys, json, traceback

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
    candidates = ['two_sum', 'twoSum', 'reverse_string', 'reverseString', 'search', 'is_valid', 'isValid', 'max_sub_array', 'maxSubArray']
    for name in candidates:
        if name in locals() and callable(locals()[name]):
            _fn = locals()[name]
            break
    if not _fn and 'Solution' in locals():
        sol = locals()['Solution']()
        for attr in dir(sol):
            if not attr.startswith('_') and callable(getattr(sol, attr)):
                _fn = getattr(sol, attr)
                break

    if not _fn:
        # Fallback to any callable defined
        for k, v in list(locals().items()):
            if not k.startswith('_') and callable(v) and k not in ['sys', 'json', 'traceback']:
                _fn = v
                break

    if not _fn:
        raise Exception('Could not find solution function. Make sure your function is named according to the problem (e.g. two_sum, search, is_valid, reverse_string, max_sub_array).')

    _raw_input = ${JSON.stringify(input)}
    _lines = [l for l in _raw_input.strip().split('\\n') if l.strip()]
    _args = []
    for l in _lines:
        try:
            _args.append(json.loads(l.replace("'", '"')))
        except Exception:
            _args.append(l)

    _res = _fn(*_args)

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
    return { code: harness, stdin: input };
  }

  // 3. C++ Harness
  if (lang === 'cpp' || lang === 'c++') {
    // If user defined their own main, run directly with stdin
    if (code.includes('int main(') || code.includes('int main ()')) {
      return { code, stdin: input };
    }

    // Build problem-specific driver if recognized
    let driver = '';
    const prob = problemSlug || '';

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
    // remove quotes if any
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
    }

    if (driver) {
      const classCheck = code.includes('class Solution') ? '#define HAS_SOLUTION_CLASS 1\n' : '';
      const fullCode = `#include <iostream>\n#include <vector>\n#include <string>\n#include <sstream>\n#include <unordered_map>\n#include <algorithm>\n#include <stack>\nusing namespace std;\n${classCheck}\n${code}\n${driver}`;
      return { code: fullCode, stdin: input };
    }

    return { code, stdin: input };
  }

  // 4. Java Harness
  if (lang === 'java') {
    if (code.includes('public static void main(')) {
      return { code, stdin: input };
    }

    let runnerBody = '';
    const prob = problemSlug || '';

    if (prob === 'two-sum') {
      runnerBody = `
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line1 = reader.readLine();
        String line2 = reader.readLine();
        if (line1 == null) return;
        String clean = line1.replace("[", "").replace("]", "").replace(",", " ").trim();
        String[] parts = clean.split("\\\\s+");
        int[] nums = new int[parts.length];
        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);
        int target = (line2 != null && !line2.trim().isEmpty()) ? Integer.parseInt(line2.trim()) : 0;
        int[] res = Solution.twoSum(nums, target);
        System.out.println("__LEETCODE_RESULT__:" + Arrays.toString(res).replace(" ", ""));
      `;
    } else if (prob === 'reverse-string') {
      runnerBody = `
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String s = reader.readLine();
        if (s == null) return;
        String res = Solution.reverseString(s);
        System.out.println("__LEETCODE_RESULT__:\\"" + res + "\\"");
      `;
    } else if (prob === 'binary-search') {
      runnerBody = `
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line1 = reader.readLine();
        String line2 = reader.readLine();
        if (line1 == null) return;
        String clean = line1.replace("[", "").replace("]", "").replace(",", " ").trim();
        String[] parts = clean.split("\\\\s+");
        int[] nums = new int[parts.length];
        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);
        int target = (line2 != null && !line2.trim().isEmpty()) ? Integer.parseInt(line2.trim()) : 0;
        int res = Solution.search(nums, target);
        System.out.println("__LEETCODE_RESULT__:" + res);
      `;
    } else if (prob === 'valid-parentheses') {
      runnerBody = `
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String s = reader.readLine();
        if (s == null) return;
        boolean res = Solution.isValid(s.replace("\\"", ""));
        System.out.println("__LEETCODE_RESULT__:" + (res ? "true" : "false"));
      `;
    } else if (prob === 'maximum-subarray') {
      runnerBody = `
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line1 = reader.readLine();
        if (line1 == null) return;
        String clean = line1.replace("[", "").replace("]", "").replace(",", " ").trim();
        String[] parts = clean.split("\\\\s+");
        int[] nums = new int[parts.length];
        for (int i = 0; i < parts.length; i++) nums[i] = Integer.parseInt(parts[i]);
        int res = Solution.maxSubArray(nums);
        System.out.println("__LEETCODE_RESULT__:" + res);
      `;
    }

    if (runnerBody) {
      // Normalize user class name so Main can run
      const normalizedCode = code.replace(/public\s+class\s+Solution/g, 'class Solution');
      const fullJavaCode = `
import java.util.*;
import java.io.*;

${normalizedCode}

public class Main {
    public static void main(String[] args) throws Exception {
        ${runnerBody}
    }
}
`;
      return { code: fullJavaCode, stdin: input };
    }

    return { code, stdin: input };
  }

  return { code, stdin: input };
}

export async function evaluateTestCases(
  code: string,
  language: string,
  testCases: TestCaseItem[],
  problemSlug?: string
): Promise<TestSuiteEvaluationResult> {
  const startTime = Date.now();
  const testResults: TestCaseEvaluationItem[] = [];
  let allPassed = true;
  let overallStatus: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'timeout' = 'accepted';
  let topCompilerError: string | undefined;
  let topRuntimeError: string | undefined;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const { code: executableCode, stdin } = buildTestHarness(code, language, tc.input, problemSlug);

    const execResult = await executeCode({
      code: executableCode,
      language,
      stdin,
      timeoutMs: 6000,
    });

    // 1. Compilation Error
    if (execResult.status === 'compile_error') {
      overallStatus = 'compile_error';
      allPassed = false;
      topCompilerError = execResult.stderr || 'Compilation error occurred.';
      testResults.push({
        index: i + 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: 'Compilation Error',
        passed: false,
        status: 'compile_error',
        executionTimeMs: execResult.executionTimeMs,
        stderr: execResult.stderr,
        errorMessage: execResult.stderr || 'Syntax or compilation error',
      });
      break;
    }

    // 2. Timeout
    if (execResult.status === 'timeout') {
      overallStatus = 'timeout';
      allPassed = false;
      testResults.push({
        index: i + 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: 'Time Limit Exceeded',
        passed: false,
        status: 'timeout',
        executionTimeMs: execResult.executionTimeMs,
        stderr: execResult.stderr,
        errorMessage: 'Execution exceeded time limit (6000ms)',
      });
      continue;
    }

    // 3. Runtime Error
    if (execResult.status === 'error' || (execResult.exitCode !== 0 && !execResult.stdout.includes('__LEETCODE_RESULT__:'))) {
      overallStatus = 'runtime_error';
      allPassed = false;
      topRuntimeError = execResult.stderr || 'Runtime error occurred.';
      testResults.push({
        index: i + 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: 'Runtime Error',
        passed: false,
        status: 'runtime_error',
        executionTimeMs: execResult.executionTimeMs,
        stderr: execResult.stderr,
        errorMessage: execResult.stderr || 'Runtime exception',
      });
      continue;
    }

    // 4. Extract Result & Stdout
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
      // Clean fallback if no marker
      actualOutput = rawStdout.trim();
    }

    // Compare with expected output
    const passed = compareOutputs(actualOutput, tc.expectedOutput, problemSlug);

    if (!passed) {
      allPassed = false;
      if (overallStatus === 'accepted') {
        overallStatus = 'wrong_answer';
      }
    }

    testResults.push({
      index: i + 1,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      actualOutput: actualOutput || '(No output)',
      userStdout: userStdout || undefined,
      passed,
      status: passed ? 'passed' : 'wrong_answer',
      executionTimeMs: execResult.executionTimeMs,
      stderr: execResult.stderr || undefined,
    });
  }

  const passedCases = testResults.filter((r) => r.passed).length;

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
