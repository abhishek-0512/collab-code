import api from './api';
import type { ExecutionResult, ApiResponse, TestSuiteEvaluationResult } from '../types';

export interface SubmissionResponse {
  submissionId: string;
  verdict: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'time_limit' | 'judge_error';
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  executionTimeMs: number;
  testResults: Array<{
    index: number;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    status: string;
    executionTimeMs: number;
    stderr?: string;
  }>;
  status: string;
}

export interface SubmissionRecord {
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

export async function runCode(data: {
  code: string;
  language: string;
  stdin?: string;
  roomId?: string;
}): Promise<ExecutionResult> {
  const res = await api.post<ApiResponse<ExecutionResult>>('/execution/run', data);
  if (!res.data.data) throw new Error(res.data.error || 'Execution failed');
  return res.data.data;
}

export async function testCode(data: {
  code: string;
  language: string;
  problemSlug?: string;
  testCases?: Array<{ input: string; expectedOutput: string }>;
}): Promise<TestSuiteEvaluationResult> {
  const res = await api.post<ApiResponse<TestSuiteEvaluationResult>>('/execution/test', data);
  if (!res.data.data) throw new Error(res.data.error || 'Test evaluation failed');
  return res.data.data;
}

export async function submitCode(data: {
  code: string;
  language: string;
  roomId: string;
  problemSlug?: string;
}): Promise<SubmissionResponse> {
  const res = await api.post<ApiResponse<SubmissionResponse>>('/execution/submit', data);
  if (!res.data.data) throw new Error(res.data.error || 'Submission failed');
  return res.data.data;
}

export async function getSubmissions(roomId: string): Promise<SubmissionRecord[]> {
  const res = await api.get<ApiResponse<SubmissionRecord[]>>(`/execution/submissions?roomId=${roomId}`);
  return res.data.data || [];
}
