/**
 * Collab Code — Shared Domain & Protocol Types
 * Shared between Server and Client
 */

export type RoomLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'cpp'
  | 'go'
  | 'rust';

export type ProblemDifficulty = 'easy' | 'medium' | 'hard';

export type SubmissionStatus =
  | 'pending'
  | 'running'
  | 'accepted'
  | 'wrong_answer'
  | 'time_limit'
  | 'runtime_error'
  | 'compile_error';

export interface UserSummary {
  id: string;
  username: string;
  email: string;
  createdAt?: string;
}

export interface RoomSummary {
  id: string;
  roomId: string;
  name: string;
  description?: string;
  language: RoomLanguage;
  code: string;
  isPrivate: boolean;
  inviteCode: string;
  isOwner: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollaboratorPresence {
  socketId: string;
  userId?: string;
  username: string;
  color: string;
  joinedAt: string;
}

export interface CursorPosition {
  lineNumber: number;
  column: number;
}

export interface RoomChatMessage {
  socketId: string;
  userId?: string;
  username: string;
  color: string;
  message: string;
  timestamp: string;
  audioUrl?: string; // Voice Note audio attachment
  isVoiceTranscribed?: boolean;
}

export interface CodeExecutionRequest {
  code: string;
  language: RoomLanguage | string;
  stdin?: string;
  timeoutMs?: number;
}

export interface CodeExecutionResponse {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  status: 'success' | 'error' | 'timeout' | 'compile_error' | 'unavailable';
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface ProblemDetail {
  slug: string;
  title: string;
  description: string;
  difficulty: ProblemDifficulty;
  tags: string[];
  constraints: string;
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  starterCode?: Record<string, string>;
}

// ─── WebRTC Voice Room Protocol ────────────────────────────

export interface VoiceParticipantState {
  socketId: string;
  userId?: string;
  username: string;
  color: string;
  isMuted: boolean;
  isSpeaking: boolean;
  joinedAt: string;
}

export type VoiceConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

// ─── Workspace Types ───────────────────────────────────────

export interface WorkspaceUser {
  socketId: string;
  userId?: string;
  username: string;
  color: string;
  code: string;
  language: string;
  updatedAt: string;
}

export interface TestCaseEvaluation {
  index: number;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  passed: boolean;
  status: 'passed' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'timeout';
  executionTimeMs: number;
  stderr?: string;
}

export interface TestSuiteEvaluationResult {
  allPassed: boolean;
  totalCases: number;
  passedCases: number;
  status: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'timeout';
  testResults: TestCaseEvaluation[];
  totalTimeMs: number;
}
