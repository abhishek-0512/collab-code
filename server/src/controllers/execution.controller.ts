import { Response } from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedRequest } from '../types';
import { executeCode, evaluateTestCases, TestCaseItem, Verdict } from '../services/execution.service';
import { getProblemBySlug } from '../services/problem.service';
import { Submission } from '../models/Submission';
import { sendSuccess, sendError } from '../utils/apiResponse';

export interface MemorySubmission {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  problemSlug?: string;
  language: string;
  status: Verdict;
  passedCount: number;
  totalCount: number;
  executionTimeMs: number;
  createdAt: string;
}

const inMemorySubmissions: MemorySubmission[] = [];

// ─── Run Code (Quick Execution against custom input or stdin) ───

export async function runCode(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { code, language, stdin, timeoutMs } = req.body as {
      code: string;
      language: string;
      stdin?: string;
      timeoutMs?: number;
    };

    if (!code || typeof code !== 'string' || !code.trim()) {
      sendError(res, 'Code string cannot be empty', 422);
      return;
    }
    if (!language || typeof language !== 'string' || !language.trim()) {
      sendError(res, 'Language name is required', 422);
      return;
    }

    const executionId = randomUUID();
    const result = await executeCode({ code, language, stdin, timeoutMs });

    sendSuccess(res, {
      executionId,
      ...result,
    });
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Execution failed', 500);
  }
}

// ─── Test Code (Sample & Visible Tests / Custom Input) ─────────

export async function testCode(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { code, language, problemSlug, testCases } = req.body as {
      code: string;
      language: string;
      problemSlug?: string;
      testCases?: Array<{ input: string; expectedOutput?: string }>;
    };

    if (!code || typeof code !== 'string' || !code.trim()) {
      sendError(res, 'Code string cannot be empty', 422);
      return;
    }
    if (!language || typeof language !== 'string' || !language.trim()) {
      sendError(res, 'Language name is required', 422);
      return;
    }

    let casesToRun: TestCaseItem[] = [];

    let targetSlug = problemSlug;
    if (!targetSlug) {
      if (code.includes('threeSum') || code.includes('three_sum')) targetSlug = '3sum';
      else if (code.includes('isPalindrome') || code.includes('is_palindrome')) targetSlug = 'palindrome-number';
      else if (code.includes('twoSum') || code.includes('two_sum')) targetSlug = 'two-sum';
      else if (code.includes('reverseString') || code.includes('reverse_string')) targetSlug = 'reverse-string';
      else if (code.includes('maxSubArray') || code.includes('max_sub_array')) targetSlug = 'maximum-subarray';
    }

    if (Array.isArray(testCases) && testCases.length > 0) {
      casesToRun = testCases.map((tc) => ({
        input: tc.input ?? '',
        expectedOutput: tc.expectedOutput,
      }));
    } else if (targetSlug) {
      try {
        const problem = await getProblemBySlug(targetSlug);
        if (problem && problem.testCases && problem.testCases.length > 0) {
          // For sample runs, only run visible tests
          const sampleCases = problem.testCases.filter((tc: any) => !tc.isHidden);
          casesToRun = (sampleCases.length > 0 ? sampleCases : problem.testCases).map((tc: any) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
          }));
        }
      } catch {
        // Fall back
      }
    }

    if (casesToRun.length === 0) {
      sendError(res, 'No sample test cases found. Please select or import a problem from the drawer, or enter input in the Custom Input tab.', 400);
      return;
    }

    const evaluation = await evaluateTestCases(code, language, casesToRun, targetSlug || problemSlug, {
      stopOnFirstFailure: false,
    });

    sendSuccess(res, evaluation, 'Sample test cases evaluated');
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Evaluation failed', 500);
  }
}

// ─── Submit Code (Full Test Suite with Hidden Tests) ───────────

export async function submitCode(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { code, language, roomId, problemSlug } = req.body as {
      code: string;
      language: string;
      roomId: string;
      problemSlug?: string;
    };

    if (!code || typeof code !== 'string' || !code.trim()) {
      sendError(res, 'Code string cannot be empty', 422);
      return;
    }
    if (!language || typeof language !== 'string' || !language.trim()) {
      sendError(res, 'language is required', 422);
      return;
    }
    if (!roomId) {
      sendError(res, 'roomId is required', 422);
      return;
    }

    let allProblemCases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }> = [];

    let targetSlug = problemSlug;
    if (!targetSlug) {
      if (code.includes('threeSum') || code.includes('three_sum')) targetSlug = '3sum';
      else if (code.includes('isPalindrome') || code.includes('is_palindrome')) targetSlug = 'palindrome-number';
      else if (code.includes('twoSum') || code.includes('two_sum')) targetSlug = 'two-sum';
      else if (code.includes('reverseString') || code.includes('reverse_string')) targetSlug = 'reverse-string';
      else if (code.includes('maxSubArray') || code.includes('max_sub_array')) targetSlug = 'maximum-subarray';
    }

    if (targetSlug) {
      try {
        const problem = await getProblemBySlug(targetSlug);
        if (problem && problem.testCases && problem.testCases.length > 0) {
          allProblemCases = problem.testCases;
        }
      } catch {
        // Problem not found or error loading
      }
    }

    // A real online judge MUST NOT fabricate successful verdicts if test cases are missing!
    if (allProblemCases.length === 0) {
      sendError(res, `No authorized test cases found for problem '${problemSlug || targetSlug || 'unknown'}'. Please select or import a problem from the drawer first.`, 400);
      return;
    }

    const evaluation = await evaluateTestCases(
      code,
      language,
      allProblemCases.map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput })),
      targetSlug || problemSlug
    );

    const verdict: Verdict = evaluation.status;

    // SECURITY: Strictly sanitize hidden test cases — never leak inputs, expected outputs, userStdout or stderr
    const sanitizedResults = evaluation.testResults.map((r, i) => {
      const isHidden = allProblemCases[i]?.isHidden ?? false;
      if (isHidden) {
        return {
          index: r.index,
          input: '[Hidden Test Case]',
          expectedOutput: '[Hidden]',
          actualOutput: r.passed ? '[Hidden - Passed]' : '[Hidden - Failed]',
          passed: r.passed,
          status: r.status,
          executionTimeMs: r.executionTimeMs,
          userStdout: undefined,
          stderr: undefined,
          errorMessage: r.passed ? undefined : 'Failed on hidden test case',
        };
      }
      return r;
    });

    const submissionId = randomUUID();
    const userId = req.user?.userId || 'anonymous';
    const username = req.user?.username || 'Collaborator';

    // Persist to MongoDB if active
    if (mongoose.connection.readyState === 1) {
      try {
        await Submission.create({
          roomId,
          userId: req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : new mongoose.Types.ObjectId(),
          language,
          code,
          status:
            verdict === 'judge_error' || verdict === 'output_limit'
              ? 'runtime_error'
              : verdict,
          output: `Passed ${evaluation.passedCases} of ${evaluation.totalCases} tests`,
          executionTimeMs: evaluation.totalTimeMs,
          testResults: sanitizedResults.map((s) => ({
            passed: s.passed,
            input: s.input,
            expected: s.expectedOutput,
            actual: s.actualOutput,
          })),
        });
      } catch (dbErr) {
        console.error('[Submission] DB save warning:', dbErr);
      }
    }

    // Save in-memory submission record
    inMemorySubmissions.push({
      id: submissionId,
      roomId,
      userId,
      username,
      problemSlug,
      language,
      status: verdict,
      passedCount: evaluation.passedCases,
      totalCount: evaluation.totalCases,
      executionTimeMs: evaluation.totalTimeMs,
      createdAt: new Date().toISOString(),
    });

    sendSuccess(res, {
      submissionId,
      executionId: submissionId,
      verdict,
      status: verdict,
      allPassed: evaluation.allPassed,
      passedCount: evaluation.passedCases,
      totalCount: evaluation.totalCases,
      executionTimeMs: evaluation.totalTimeMs,
      compileOutput: evaluation.compilerError,
      compileError: evaluation.compilerError,
      runtimeError: evaluation.runtimeError,
      testResults: sanitizedResults,
    }, 'Solution evaluated', 201);
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Submission failed', 500);
  }
}

// ─── Get Submissions ──────────────────────────────────────────

export async function getSubmissions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { roomId } = req.query as { roomId?: string };
  const filtered = roomId
    ? inMemorySubmissions.filter((s) => s.roomId === roomId)
    : inMemorySubmissions;
  sendSuccess(res, filtered.slice(-20).reverse());
}
