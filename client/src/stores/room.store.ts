import { create } from 'zustand';
import type {
  Room,
  RoomUser,
  ChatMessage,
  Language,
  VoiceParticipant,
  VoiceStatus,
  WorkspaceStatus,
  SharedWorkspaceSnapshot,
  ViewMode,
} from '../types';

// ─── State Interface ────────────────────────────────────────

interface RoomState {
  // Room
  currentRoom: Room | null;
  users: RoomUser[];
  messages: ChatMessage[];
  isConnected: boolean;

  // My independent workspace
  myCode: string;
  myLanguage: Language;
  isSharing: boolean;

  // Other participants' workspace statuses (sidebar info)
  workspaceStatuses: Map<string, WorkspaceStatus>;

  // Shared workspace snapshots (live code from shared editors)
  sharedSnapshots: Map<string, SharedWorkspaceSnapshot>;

  // View control (local only — doesn't affect other users)
  viewMode: ViewMode;
  focusedSocketId: string | null;

  // Remote cursors
  remoteCursors: Map<string, { socketId: string; username: string; color: string; cursor: { lineNumber: number; column: number } }>;

  // Voice state
  voiceParticipants: Map<string, VoiceParticipant>;
  isVoiceJoined: boolean;
  isMuted: boolean;
  isLocalSpeaking: boolean;
  voiceStatus: VoiceStatus;
  voiceError: string | null;
  isVoiceOnlyMode: boolean;

  // Granular collaborator co-editing permissions: ownerSocketId -> array of socketIds with write access
  editorPermissions: Record<string, string[]>;

  // ─── Actions ────────────────────────────────────────────────

  // Room
  setCurrentRoom: (room: Room | null) => void;
  setUsers: (users: RoomUser[]) => void;
  addUser: (user: RoomUser) => void;
  removeUser: (socketId: string) => void;
  addMessage: (message: ChatMessage) => void;
  setConnected: (connected: boolean) => void;

  // My workspace
  setMyCode: (code: string) => void;
  setMyLanguage: (language: Language) => void;
  setIsSharing: (sharing: boolean) => void;

  // Workspace statuses (all participants)
  setWorkspaceStatuses: (statuses: WorkspaceStatus[]) => void;
  updateWorkspaceStatus: (status: WorkspaceStatus) => void;
  removeWorkspaceStatus: (socketId: string) => void;

  // Shared snapshots
  setSharedSnapshots: (snapshots: SharedWorkspaceSnapshot[]) => void;
  addSharedSnapshot: (snapshot: SharedWorkspaceSnapshot) => void;
  updateSharedSnapshot: (snapshot: SharedWorkspaceSnapshot) => void;
  removeSharedSnapshot: (socketId: string) => void;

  // View control
  setViewMode: (mode: ViewMode) => void;
  setFocusedSocketId: (socketId: string | null) => void;

  // Remote cursors
  updateCursor: (cursor: { socketId: string; username: string; color: string; cursor: { lineNumber: number; column: number } }) => void;
  removeCursor: (socketId: string) => void;

  // Voice
  setVoiceParticipants: (participants: VoiceParticipant[]) => void;
  addVoiceParticipant: (participant: VoiceParticipant) => void;
  removeVoiceParticipant: (socketId: string) => void;
  updateVoiceParticipantMute: (socketId: string, isMuted: boolean) => void;
  updateVoiceParticipantSpeaking: (socketId: string, isSpeaking: boolean) => void;
  setVoiceJoined: (joined: boolean) => void;
  setIsMuted: (muted: boolean) => void;
  setIsLocalSpeaking: (speaking: boolean) => void;
  setVoiceStatus: (status: VoiceStatus) => void;
  setVoiceError: (error: string | null) => void;
  toggleVoiceOnlyMode: () => void;

  // Permissions
  setAllPermissions: (perms: Record<string, string[]>) => void;
  updateEditorPermission: (ownerSocketId: string, targetSocketId: string, canWrite: boolean) => void;
  updateSharedSnapshotCode: (ownerSocketId: string, code: string) => void;

  reset: () => void;
}

// ─── Initial State ──────────────────────────────────────────

const initialState = {
  currentRoom: null,
  users: [],
  messages: [],
  isConnected: false,
  myCode: '',
  myLanguage: 'javascript' as Language,
  isSharing: false,
  workspaceStatuses: new Map<string, WorkspaceStatus>(),
  sharedSnapshots: new Map<string, SharedWorkspaceSnapshot>(),
  editorPermissions: {} as Record<string, string[]>,
  viewMode: 'my-editor' as ViewMode,
  focusedSocketId: null,
  remoteCursors: new Map(),
  voiceParticipants: new Map<string, VoiceParticipant>(),
  isVoiceJoined: false,
  isMuted: false,
  isLocalSpeaking: false,
  voiceStatus: 'idle' as VoiceStatus,
  voiceError: null,
  isVoiceOnlyMode: false,
};

// ─── Store ──────────────────────────────────────────────────

export const useRoomStore = create<RoomState>((set) => ({
  ...initialState,

  // Room actions
  setCurrentRoom: (room) =>
    set({ currentRoom: room }),

  setUsers: (users) => set({ users }),

  addUser: (user) =>
    set((s) => ({
      users: [...s.users.filter((u) => u.socketId !== user.socketId), user],
    })),

  removeUser: (socketId) =>
    set((s) => {
      const cursors = new Map(s.remoteCursors);
      cursors.delete(socketId);
      const vp = new Map(s.voiceParticipants);
      vp.delete(socketId);
      const ws = new Map(s.workspaceStatuses);
      ws.delete(socketId);
      const ss = new Map(s.sharedSnapshots);
      ss.delete(socketId);
      return {
        users: s.users.filter((u) => u.socketId !== socketId),
        remoteCursors: cursors,
        voiceParticipants: vp,
        workspaceStatuses: ws,
        sharedSnapshots: ss,
      };
    }),

  addMessage: (message) =>
    set((s) => ({
      messages: [...s.messages.slice(-300), message],
    })),

  setConnected: (isConnected) => set({ isConnected }),

  // My workspace actions
  setMyCode: (code) => set({ myCode: code }),
  setMyLanguage: (language) => set({ myLanguage: language }),
  setIsSharing: (sharing) => set({ isSharing: sharing }),

  // Workspace statuses
  setWorkspaceStatuses: (statuses) => {
    const map = new Map<string, WorkspaceStatus>();
    statuses.forEach((s) => map.set(s.socketId, s));
    set({ workspaceStatuses: map });
  },

  updateWorkspaceStatus: (status) =>
    set((s) => {
      const next = new Map(s.workspaceStatuses);
      next.set(status.socketId, status);
      return { workspaceStatuses: next };
    }),

  removeWorkspaceStatus: (socketId) =>
    set((s) => {
      const next = new Map(s.workspaceStatuses);
      next.delete(socketId);
      return { workspaceStatuses: next };
    }),

  // Shared snapshots
  setSharedSnapshots: (snapshots) => {
    const map = new Map<string, SharedWorkspaceSnapshot>();
    snapshots.forEach((s) => map.set(s.socketId, s));
    set({ sharedSnapshots: map });
  },

  addSharedSnapshot: (snapshot) =>
    set((s) => {
      const next = new Map(s.sharedSnapshots);
      next.set(snapshot.socketId, snapshot);
      return { sharedSnapshots: next };
    }),

  updateSharedSnapshot: (snapshot) =>
    set((s) => {
      const next = new Map(s.sharedSnapshots);
      next.set(snapshot.socketId, snapshot);
      return { sharedSnapshots: next };
    }),

  removeSharedSnapshot: (socketId) =>
    set((s) => {
      const next = new Map(s.sharedSnapshots);
      next.delete(socketId);
      return { sharedSnapshots: next };
    }),

  updateSharedSnapshotCode: (ownerSocketId, code) =>
    set((s) => {
      const next = new Map(s.sharedSnapshots);
      const snap = next.get(ownerSocketId);
      if (snap) {
        next.set(ownerSocketId, { ...snap, code, updatedAt: new Date().toISOString() });
      }
      return { sharedSnapshots: next };
    }),

  // Permission actions
  setAllPermissions: (perms) => set({ editorPermissions: perms }),

  updateEditorPermission: (ownerSocketId, targetSocketId, canWrite) =>
    set((s) => {
      const perms = { ...s.editorPermissions };
      const currentList = Array.isArray(perms[ownerSocketId]) ? [...perms[ownerSocketId]] : [];
      if (canWrite) {
        if (!currentList.includes(targetSocketId)) currentList.push(targetSocketId);
      } else {
        const idx = currentList.indexOf(targetSocketId);
        if (idx !== -1) currentList.splice(idx, 1);
      }
      perms[ownerSocketId] = currentList;
      return { editorPermissions: perms };
    }),

  // View control
  setViewMode: (mode) => set({ viewMode: mode }),
  setFocusedSocketId: (socketId) => set({ focusedSocketId: socketId }),

  // Cursors
  updateCursor: (cursor) =>
    set((s) => {
      const next = new Map(s.remoteCursors);
      next.set(cursor.socketId, cursor);
      return { remoteCursors: next };
    }),

  removeCursor: (socketId) =>
    set((s) => {
      const next = new Map(s.remoteCursors);
      next.delete(socketId);
      return { remoteCursors: next };
    }),

  // Voice actions
  setVoiceParticipants: (participants) => {
    const map = new Map<string, VoiceParticipant>();
    participants.forEach((p) => map.set(p.socketId, p));
    set({ voiceParticipants: map });
  },
  addVoiceParticipant: (participant) =>
    set((s) => {
      const next = new Map(s.voiceParticipants);
      next.set(participant.socketId, participant);
      return { voiceParticipants: next };
    }),
  removeVoiceParticipant: (socketId) =>
    set((s) => {
      const next = new Map(s.voiceParticipants);
      next.delete(socketId);
      return { voiceParticipants: next };
    }),
  updateVoiceParticipantMute: (socketId, isMuted) =>
    set((s) => {
      const next = new Map(s.voiceParticipants);
      const p = next.get(socketId);
      if (p) next.set(socketId, { ...p, isMuted });
      return { voiceParticipants: next };
    }),
  updateVoiceParticipantSpeaking: (socketId, isSpeaking) =>
    set((s) => {
      const next = new Map(s.voiceParticipants);
      const p = next.get(socketId);
      if (p) next.set(socketId, { ...p, isSpeaking });
      return { voiceParticipants: next };
    }),
  setVoiceJoined: (joined) => set({ isVoiceJoined: joined }),
  setIsMuted: (muted) => set({ isMuted: muted }),
  setIsLocalSpeaking: (speaking) => set({ isLocalSpeaking: speaking }),
  setVoiceStatus: (status) => set({ voiceStatus: status }),
  setVoiceError: (error) => set({ voiceError: error }),
  toggleVoiceOnlyMode: () => set((s) => ({ isVoiceOnlyMode: !s.isVoiceOnlyMode })),

  reset: () => set({ ...initialState }),
}));
