export type ExecutionStatus =
  | 'success'
  | 'error'
  | 'timeout'
  | 'compile_error'
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
  memoryUsedKb?: number;
  providerReference?: string;
}

export interface ExecutionProvider {
  submitExecution(request: ExecutionRequest): Promise<string>;
  getExecutionResult(reference: string): Promise<ExecutionResult | null>;
  getSupportedLanguages(): Promise<string[]>;
  healthCheck(): Promise<boolean>;
}
