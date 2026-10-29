import { Response } from 'express';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedRequest } from '../types';
import { executeCode, evaluateTestCases, TestCaseItem } from '../services/execution.service';
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
  status: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'time_limit' | 'judge_error';
  passedCount: number;
  totalCount: number;
  executionTimeMs: number;
  createdAt: string;
}

const inMemorySubmissions: MemorySubmission[] = [];

// ─── Run Code (Quick Execution) ─────────────────────────────

export async function runCode(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { code, language, stdin, timeoutMs } = req.body as {
      code: string;
      language: string;
      stdin?: string;
      timeoutMs?: number;
    };

    if (!code || typeof code !== 'string') {
      sendError(res, 'Code string is required', 422);
      return;
    }
    if (!language || typeof language !== 'string') {
      sendError(res, 'Language name is required', 422);
      return;
    }

    const result = await executeCode({ code, language, stdin, timeoutMs });
    sendSuccess(res, result);
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Execution failed', 500);
  }
}

// ─── Test Code (Sample & Visible Tests) ──────────────────────

export async function testCode(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { code, language, problemSlug, testCases } = req.body as {
      code: string;
      language: string;
      problemSlug?: string;
      testCases?: Array<{ input: string; expectedOutput: string }>;
    };

    if (!code || typeof code !== 'string') {
      sendError(res, 'Code string is required', 422);
      return;
    }
    if (!language || typeof language !== 'string') {
      sendError(res, 'Language name is required', 422);
      return;
    }

    let casesToRun: TestCaseItem[] = [];

    if (Array.isArray(testCases) && testCases.length > 0) {
      casesToRun = testCases;
    } else if (problemSlug) {
      try {
        const problem = await getProblemBySlug(problemSlug);
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
      sendError(res, 'No sample test cases found for this problem', 400);
      return;
    }

    const evaluation = await evaluateTestCases(code, language, casesToRun, problemSlug);
    sendSuccess(res, evaluation, 'Sample test cases evaluated');
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Evaluation failed', 500);
  }
}

// ─── Submit Code (Full Test Suite with Hidden Tests) ────────

export async function submitCode(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { code, language, roomId, problemSlug } = req.body as {
      code: string;
      language: string;
      roomId: string;
      problemSlug?: string;
    };

    if (!code || !language || !roomId) {
      sendError(res, 'code, language, and roomId are required', 422);
      return;
    }

    let allProblemCases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }> = [];

    if (problemSlug) {
      try {
        const problem = await getProblemBySlug(problemSlug);
        if (problem && problem.testCases && problem.testCases.length > 0) {
          allProblemCases = problem.testCases;
        }
      } catch {
        // Fallback
      }
    }

    // If no test cases exist, execute single run
    if (allProblemCases.length === 0) {
      const singleRun = await executeCode({ code, language });
      const verdict =
        singleRun.status === 'success'
          ? 'accepted'
          : singleRun.status === 'compile_error'
          ? 'compile_error'
          : singleRun.status === 'timeout'
          ? 'time_limit'
          : singleRun.status === 'judge_error' || singleRun.status === 'unavailable'
          ? 'judge_error'
          : 'runtime_error';
      return sendSuccess(res, {
        submissionId: randomUUID(),
        verdict,
        allPassed: verdict === 'accepted',
        passedCount: verdict === 'accepted' ? 1 : 0,
        totalCount: 1,
        executionTimeMs: singleRun.executionTimeMs,
        testResults: [],
        status: verdict,
      });
    }

    const evaluation = await evaluateTestCases(
      code,
      language,
      allProblemCases.map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput })),
      problemSlug
    );

    const verdict =
      evaluation.status === 'compile_error'
        ? 'compile_error'
        : evaluation.status === 'timeout'
        ? 'time_limit'
        : evaluation.status === 'runtime_error'
        ? 'runtime_error'
        : evaluation.status === 'judge_error'
        ? 'judge_error'
        : evaluation.allPassed
        ? 'accepted'
        : 'wrong_answer';

    // SECURITY: Mask hidden test cases so secret inputs/outputs are never leaked
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
          status: verdict,
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
      verdict,
      allPassed: evaluation.allPassed,
      passedCount: evaluation.passedCases,
      totalCount: evaluation.totalCases,
      executionTimeMs: evaluation.totalTimeMs,
      testResults: sanitizedResults,
      status: verdict,
    }, 'Solution evaluated', 201);
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Submission failed', 500);
  }
}

// ─── Get Submissions ────────────────────────────────────────

export async function getSubmissions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { roomId } = req.query as { roomId?: string };
  const filtered = roomId
    ? inMemorySubmissions.filter((s) => s.roomId === roomId)
    : inMemorySubmissions;
  sendSuccess(res, filtered.slice(-20).reverse());
}
