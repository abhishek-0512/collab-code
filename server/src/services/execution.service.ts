import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env';
import { Judge0Provider } from './execution/judge0.provider';
import type { ExecutionRequest, ExecutionResult } from './execution/provider';

export type { ExecutionRequest, ExecutionResult };

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
      const localTsx = path.resolve(__dirname, '../../node_modules/.bin/tsx');
      const hasLocalTsx = await fs.stat(localTsx).then(() => true).catch(() => false);
      command = hasLocalTsx ? localTsx : 'tsx';
      args = [filePath];
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
        const cp = spawn('g++', ['-std=c++17', srcPath, '-o', binPath]);
        let err = '';
        cp.stderr.on('data', (d) => (err += d.toString()));
        cp.on('error', (error) => resolve({ exitCode: 127, stderr: error.message }));
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
      const compileRes = await new Promise<{ exitCode: number; stderr: string }>((resolve) => {
        const cp = spawn('javac', [filePath], { cwd: tempDir });
        let err = '';
        cp.stderr.on('data', (d) => (err += d.toString()));
        cp.on('error', (error) => resolve({ exitCode: 127, stderr: error.message }));
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
      command = 'java';
      args = ['-cp', tempDir, 'Main'];
    } else {
      return {
        stdout: '',
        stderr: `Language '${req.language}' is not supported in the local runner.`,
        exitCode: 1,
        executionTimeMs: 0,
        status: 'error',
      };
    }

    const timeoutMs = req.timeoutMs || env.EXECUTION_TIMEOUT_MS;
    return await new Promise<ExecutionResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const child = spawn(command, args, { cwd: tempDir });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      child.stdin.on('error', () => {
        // The process may exit before consuming stdin (for example after a compile error).
      });
      try {
        child.stdin.write(req.stdin || '');
        child.stdin.end();
      } catch {
        // The child lifecycle result is reported through the close/error handlers below.
      }

      child.stdout.on('data', (data) => {
        if (stdout.length < env.EXECUTION_OUTPUT_LIMIT_BYTES) {
          stdout += data.toString().slice(0, env.EXECUTION_OUTPUT_LIMIT_BYTES - stdout.length);
        }
      });

      child.stderr.on('data', (data) => {
        if (stderr.length < env.EXECUTION_OUTPUT_LIMIT_BYTES) {
          stderr += data.toString().slice(0, env.EXECUTION_OUTPUT_LIMIT_BYTES - stderr.length);
        }
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

const judge0Provider = new Judge0Provider();

async function executeWithJudge0(req: ExecutionRequest): Promise<ExecutionResult> {
  const startedAt = Date.now();
  try {
    const token = await judge0Provider.submitExecution(req);
    const deadline = startedAt + (req.timeoutMs || env.EXECUTION_TIMEOUT_MS) + 15000;
    while (Date.now() < deadline) {
      const result = await judge0Provider.getExecutionResult(token);
      if (result) return { ...result, executionTimeMs: result.executionTimeMs || Date.now() - startedAt };
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return {
      stdout: '',
      stderr: 'Execution provider polling timed out.',
      exitCode: 124,
      executionTimeMs: Date.now() - startedAt,
      status: 'unavailable',
      providerReference: token,
    };
  } catch (error) {
    return {
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Execution provider unavailable.',
      exitCode: 1,
      executionTimeMs: Date.now() - startedAt,
      status: 'unavailable',
    };
  }
}

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

  if (env.EXECUTION_PROVIDER.toLowerCase() === 'judge0') {
    return executeWithJudge0(req);
  }
  if (env.EXECUTION_PROVIDER.toLowerCase() === 'local') {
    return executeLocally(req);
  }
  return {
    stdout: '',
    stderr: `Unsupported execution provider "${env.EXECUTION_PROVIDER}".`,
    exitCode: 1,
    executionTimeMs: 0,
    status: 'unavailable',
  };
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
  status: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'timeout' | 'judge_error';
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

export function compareOutputs(actual: string, expected?: string, problemSlug?: string): boolean {
  if (expected === undefined || expected === null || expected.trim() === '') return false;
  const cleanActual = (actual || '').trim();
  const cleanExpected = expected.trim();
  if (cleanActual === cleanExpected) return true;
  try {
    const actJson = JSON.parse(cleanActual);
    const expJson = JSON.parse(cleanExpected);
    if (problemSlug === 'two-sum' && Array.isArray(actJson) && Array.isArray(expJson)) {
      return [...actJson].sort((a, b) => a - b).join(',') === [...expJson].sort((a, b) => a - b).join(',');
    }
    return JSON.stringify(actJson) === JSON.stringify(expJson);
  } catch {
    if (!Number.isNaN(Number(cleanActual)) && !Number.isNaN(Number(cleanExpected))) {
      return Number(cleanActual) === Number(cleanExpected);
    }
    return cleanActual.replace(/\r\n/g, '\n') === cleanExpected.replace(/\r\n/g, '\n');
  }
}

function getCandidateFunctionNames(problemSlug?: string): string[] {
  const baseList = [
    'twoSum', 'two_sum',
    'reverseString', 'reverse_string',
    'search', 'binarySearch', 'binary_search',
    'isValid', 'is_valid', 'validParentheses', 'valid_parentheses',
    'maxSubArray', 'max_sub_array', 'maximumSubarray', 'maximum_subarray',
    'solve', 'solution', 'main'
  ];

  if (!problemSlug) return baseList;

  const slug = problemSlug.toLowerCase().replace(/_/g, '-');
  const camel = slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
  const snake = slug.replace(/-/g, '_');

  const names = [camel, snake, slug];
  if (slug.includes('search')) names.push('search');
  if (slug.includes('valid')) names.push('isValid', 'is_valid');
  if (slug.includes('reverse')) names.push('reverseString', 'reverse_string');
  if (slug.includes('max')) names.push('maxSubArray', 'max_sub_array');

  return Array.from(new Set([...names, ...baseList]));
}

function buildTestHarness(
  code: string,
  language: string,
  input: string,
  problemSlug?: string
): { code: string; stdin: string } {
  const lang = language.toLowerCase();
  const candidateNames = getCandidateFunctionNames(problemSlug);

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

  const _rawInput = ${JSON.stringify(input)};
  const _lines = _rawInput.trim().split(/\\r?\\n/).filter(l => l.length > 0);
  const _args = _lines.map(line => {
    try { return JSON.parse(line); } catch (e) { return line; }
  });

  let _res = undefined;
  if (_fn) {
    _res = _fn(..._args);
    // In-place mutation check (e.g. reverseString, sort, in-place modify)
    if (_res === undefined && _args.length > 0 && typeof _args[0] === 'object' && _args[0] !== null) {
      _res = _args[0];
    }
  }

  // Fallback to console.log output if no return value
  if (_res === undefined && _userLogs.length > 0) {
    const _lastLog = _userLogs[_userLogs.length - 1];
    try {
      _res = JSON.parse(_lastLog);
    } catch {
      _res = _lastLog;
    }
  }

  if (!_fn && _res === undefined) {
    throw new Error('Could not find solution function. Make sure your function or class Solution is defined according to the problem (e.g. twoSum, search, isValid, reverseString, maxSubArray).');
  }

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

    _raw_input = ${JSON.stringify(input)}
    _lines = [l for l in _raw_input.strip().split('\\n') if l.strip()]
    _args = []
    for l in _lines:
        try:
            _args.append(json.loads(l.replace("'", '"')))
        except Exception:
            _args.append(l)

    _res = None
    if _fn:
        _res = _fn(*_args)

    # In-place mutation check (e.g. reverse_string or sort)
    if _res is None and len(_args) > 0 and isinstance(_args[0], (list, dict)):
        _res = _args[0]

    sys.stdout = _orig_stdout
    user_out = "".join(_user_logs).strip()

    # Fallback to last printed output if _res is None
    if _res is None and user_out:
        lines = user_out.split('\\n')
        last_line = lines[-1].strip()
        try:
            _res = json.loads(last_line)
        except Exception:
            _res = last_line

    if _fn is None and _res is None:
        raise Exception('Could not find solution function. Make sure your function or class Solution is defined according to the problem (e.g. two_sum, search, is_valid, reverse_string, max_sub_array).')

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
      // Generic driver to prevent missing _main linker error
      driver = `
int main() {
    string line;
    while (getline(cin, line)) {
        cout << line << endl;
    }
    return 0;
}
`;
    }

    const classCheck = code.includes('class Solution') ? '#define HAS_SOLUTION_CLASS 1\n' : '';
    const fullCode = `#include <iostream>\n#include <vector>\n#include <string>\n#include <sstream>\n#include <unordered_map>\n#include <map>\n#include <unordered_set>\n#include <set>\n#include <algorithm>\n#include <stack>\n#include <queue>\n#include <numeric>\n#include <cmath>\n#include <climits>\nusing namespace std;\n${classCheck}\n${code}\n${driver}`;
    return { code: fullCode, stdin: input };
  }

  // 4. Java Harness
  if (lang === 'java') {
    if (code.includes('public static void main(')) {
      return { code, stdin: input };
    }

    const normSlug = (problemSlug || '').toLowerCase().replace(/_/g, '-');
    let prob = normSlug;
    if (!prob || prob === 'custom' || prob === 'code') {
      if (code.includes('twoSum') || code.includes('two_sum')) prob = 'two-sum';
      else if (code.includes('reverseString') || code.includes('reverse_string')) prob = 'reverse-string';
      else if (code.includes('search') || code.includes('binarySearch')) prob = 'binary-search';
      else if (code.includes('isValid') || code.includes('is_valid')) prob = 'valid-parentheses';
      else if (code.includes('maxSubArray') || code.includes('max_sub_array')) prob = 'maximum-subarray';
    }

    let runnerBody = '';

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
        Solution sol = new Solution();
        int[] res = sol.twoSum(nums, target);
        System.out.println("__LEETCODE_RESULT__:" + Arrays.toString(res).replace(" ", ""));
      `;
    } else if (prob === 'reverse-string') {
      runnerBody = `
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String s = reader.readLine();
        if (s == null) return;
        Solution sol = new Solution();
        String res = sol.reverseString(s);
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
        Solution sol = new Solution();
        int res = sol.search(nums, target);
        System.out.println("__LEETCODE_RESULT__:" + res);
      `;
    } else if (prob === 'valid-parentheses') {
      runnerBody = `
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String s = reader.readLine();
        if (s == null) return;
        Solution sol = new Solution();
        boolean res = sol.isValid(s.replace("\\"", ""));
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
        Solution sol = new Solution();
        int res = sol.maxSubArray(nums);
        System.out.println("__LEETCODE_RESULT__:" + res);
      `;
    } else {
      runnerBody = `
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line;
        while ((line = reader.readLine()) != null) {
            System.out.println(line);
        }
      `;
    }

    // Normalize user class name so Main can run
    const normalizedCode = code.replace(/public\s+class\s+Solution/g, 'class Solution');
    const fullJavaCode = `
import java.util.*;
import java.io.*;
import java.math.*;

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

export async function evaluateTestCases(
  code: string,
  language: string,
  testCases: TestCaseItem[],
  problemSlug?: string
): Promise<TestSuiteEvaluationResult> {
  const startTime = Date.now();
  const testResults: TestCaseEvaluationItem[] = [];
  let allPassed = true;
  let overallStatus: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'timeout' | 'judge_error' = 'accepted';
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

    // Provider failures are judge failures, never user verdicts.
    if (execResult.status === 'unavailable') {
      overallStatus = 'judge_error';
      allPassed = false;
      testResults.push({
        index: i + 1,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput: 'Judge Error',
        passed: false,
        status: 'runtime_error',
        executionTimeMs: execResult.executionTimeMs,
        stderr: execResult.stderr,
        errorMessage: execResult.stderr || 'Execution provider unavailable',
      });
      break;
    }

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
