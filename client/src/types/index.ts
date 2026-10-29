// ─── Auth Types ─────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt?: string;
}

export type Language = 'javascript' | 'typescript' | 'python' | 'java' | 'cpp' | 'go' | 'rust';

// ─── Room Types ─────────────────────────────────────────────

export interface Room {
  id: string;
  roomId: string;
  name: string;
  description?: string;
  language: Language;
  code: string;
  isPrivate: boolean;
  inviteCode: string;
  isOwner: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoomUser {
  socketId: string;
  userId?: string;
  username: string;
  color: string;
  joinedAt: string;
}

export interface ChatMessage {
  socketId: string;
  userId?: string;
  username: string;
  color: string;
  message: string;
  timestamp: string;
  audioUrl?: string;
  isVoiceTranscribed?: boolean;
}

// ─── Problem Types ──────────────────────────────────────────

export interface Problem {
  _id?: string;
  slug: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  constraints: string;
  examples: Array<{ input: string; output: string; explanation?: string }>;
  testCases?: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>;
  starterCode?: Record<string, string>;
}

// ─── Execution Types ────────────────────────────────────────

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  status: 'success' | 'error' | 'timeout' | 'compile_error' | 'unavailable';
}

export interface TestCaseEvaluation {
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
  status: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'time_limit' | 'output_limit' | 'judge_error' | 'executed' | 'timeout';
  testResults: TestCaseEvaluation[];
  totalTimeMs: number;
  compilerError?: string;
  runtimeError?: string;
}

// ─── API Response ───────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ─── Independent Workspace Types ────────────────────────────

/** Status info about any participant's workspace (never contains code for unshared) */
export interface WorkspaceStatus {
  socketId: string;
  username: string;
  isShared: boolean;
  language: string;
  isRunning: boolean;
  lastVerdict: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'timeout' | null;
  allowedWriters?: string[];
}

/** Full snapshot of a shared workspace — contains code */
export interface SharedWorkspaceSnapshot {
  socketId: string;
  userId?: string;
  username: string;
  color: string;
  code: string;
  language: string;
  allowedWriters?: string[];
  updatedAt: string;
}

export interface WorkspacePermissionUpdate {
  ownerSocketId: string;
  ownerUsername: string;
  targetSocketId: string;
  canWrite: boolean;
  allowedWriters: string[];
}

export interface WorkspacePeerCodeUpdate {
  ownerSocketId: string;
  code: string;
  editorSocketId: string;
  editorUsername: string;
  timestamp: string;
}

export type ViewMode = 'my-editor' | 'shared-grid' | 'focused';

// ─── WebRTC Voice Chat Types ────────────────────────────────

export interface VoiceParticipant {
  socketId: string;
  userId?: string;
  username: string;
  color: string;
  isMuted: boolean;
  isSpeaking: boolean;
  joinedAt: string;
}

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error';
