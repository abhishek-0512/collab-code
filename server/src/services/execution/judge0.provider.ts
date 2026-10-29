import { env } from '../../config/env';
import type { ExecutionProvider, ExecutionRequest, ExecutionResult } from './provider';

interface Judge0TokenResponse {
  token?: string;
}

interface Judge0Result {
  status?: { id?: number; description?: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  time?: string | null;
  memory?: number | null;
}

const LANGUAGE_IDS: Record<string, number> = {
  javascript: 63,
  typescript: 74,
  python: 71,
  java: 62,
  cpp: 54,
  go: 60,
  rust: 73,
};

function providerUrl(): string {
  return env.JUDGE0_URL.replace(/\/+$/, '');
}

function mapResult(result: Judge0Result): ExecutionResult {
  const statusId = result.status?.id;
  const status =
    statusId === 3
      ? 'success'
      : statusId === 6
        ? 'compile_error'
        : statusId === 5 || statusId === 7 || statusId === 8 || statusId === 9 || statusId === 10 || statusId === 11
          ? 'timeout'
          : statusId && statusId >= 4
            ? 'error'
            : 'unavailable';

  return {
    stdout: result.stdout || '',
    stderr: result.compile_output || result.stderr || result.message || '',
    exitCode: status === 'success' ? 0 : 1,
    executionTimeMs: result.time ? Math.round(Number(result.time) * 1000) : 0,
    memoryUsedKb: result.memory ?? undefined,
    status,
  };
}

export class Judge0Provider implements ExecutionProvider {
  async submitExecution(request: ExecutionRequest): Promise<string> {
    const languageId = LANGUAGE_IDS[request.language.toLowerCase()];
    if (!languageId) throw new Error(`Language "${request.language}" is not supported by Judge0`);

    const response = await fetch(`${providerUrl()}/submissions?base64_encoded=false&wait=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.JUDGE0_TOKEN ? { 'X-Auth-Token': env.JUDGE0_TOKEN } : {}),
      },
      body: JSON.stringify({
        language_id: languageId,
        source_code: request.code,
        stdin: request.stdin || '',
        cpu_time_limit: Math.max(0.1, (request.timeoutMs || env.EXECUTION_TIMEOUT_MS) / 1000),
        wall_time_limit: Math.max(1, (request.timeoutMs || env.EXECUTION_TIMEOUT_MS) / 1000 + 1),
        max_processes_and_or_threads: 32,
        max_file_size: env.EXECUTION_OUTPUT_LIMIT_BYTES,
      }),
    });

    if (!response.ok) {
      throw new Error(`Judge0 submission failed with HTTP ${response.status}`);
    }
    const data = (await response.json()) as Judge0TokenResponse;
    if (!data.token) throw new Error('Judge0 did not return an execution token');
    return data.token;
  }

  async getExecutionResult(reference: string): Promise<ExecutionResult | null> {
    const response = await fetch(`${providerUrl()}/submissions/${encodeURIComponent(reference)}?base64_encoded=false`, {
      headers: env.JUDGE0_TOKEN ? { 'X-Auth-Token': env.JUDGE0_TOKEN } : {},
    });
    if (!response.ok) throw new Error(`Judge0 result request failed with HTTP ${response.status}`);
    const data = (await response.json()) as Judge0Result;
    const statusId = data.status?.id;
    if (statusId === 1 || statusId === 2) return null;
    return { ...mapResult(data), providerReference: reference };
  }

  async getSupportedLanguages(): Promise<string[]> {
    return Object.keys(LANGUAGE_IDS);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${providerUrl()}/languages`, {
        headers: env.JUDGE0_TOKEN ? { 'X-Auth-Token': env.JUDGE0_TOKEN } : {},
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
