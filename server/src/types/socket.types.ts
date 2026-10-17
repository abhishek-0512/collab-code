// ─── Room Presence Types ────────────────────────────────────

export interface RoomUser {
  socketId: string;
  userId?: string;
  username: string;
  color: string;
  joinedAt: string;
}

// ─── Independent Workspace Types ────────────────────────────

export interface UserWorkspace {
  socketId: string;
  userId?: string;
  username: string;
  color: string;
  code: string;
  language: string;
  isShared: boolean;
  isRunning: boolean;
  lastVerdict: 'accepted' | 'wrong_answer' | 'compile_error' | 'runtime_error' | 'timeout' | null;
  allowedWriters: string[]; // socketIds of collaborators granted write permission
  updatedAt: string;
}

/** Sent to other users when a workspace is shared — contains code */
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

/** Sent to other users when a workspace is unshared — no code */
export interface WorkspaceStatusUpdate {
  socketId: string;
  username: string;
  isShared: boolean;
  language: string;
  isRunning: boolean;
  lastVerdict: UserWorkspace['lastVerdict'];
  allowedWriters?: string[];
}

export interface WorkspacePermissionUpdatePayload {
  ownerSocketId: string;
  targetSocketId: string;
  canWrite: boolean;
  allowedWriters: string[];
}

export interface WorkspacePeerEditPayload {
  ownerSocketId: string;
  code: string;
  editorSocketId: string;
  editorUsername: string;
  timestamp: string;
}

// ─── Chat Types ─────────────────────────────────────────────

export interface ChatMessagePayload {
  roomId: string;
  message: string;
  audioUrl?: string;
  isVoiceTranscribed?: boolean;
}

// ─── Cursor Types ───────────────────────────────────────────

export interface CursorPayload {
  roomId: string;
  cursor: {
    lineNumber: number;
    column: number;
  };
  username?: string;
}

// ─── WebRTC Voice Signaling Types ───────────────────────────

export interface VoiceParticipant {
  socketId: string;
  userId?: string;
  username: string;
  color: string;
  isMuted: boolean;
  isSpeaking: boolean;
  joinedAt: string;
}

export interface VoiceSignalOffer {
  roomId: string;
  targetSocketId: string;
  offer: RTCSessionDescriptionInit | any;
}

export interface VoiceSignalAnswer {
  roomId: string;
  targetSocketId: string;
  answer: RTCSessionDescriptionInit | any;
}

export interface VoiceSignalIceCandidate {
  roomId: string;
  targetSocketId: string;
  candidate: RTCIceCandidateInit | any;
}

export interface VoiceMutePayload {
  roomId: string;
  isMuted: boolean;
}

export interface VoiceSpeakingPayload {
  roomId: string;
  isSpeaking: boolean;
}
