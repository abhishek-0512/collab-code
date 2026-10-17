import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import { verifyToken } from '../utils/jwt';
import { generateUserColor } from '../utils/generateId';
import { updateRoomCode } from '../services/room.service';
import { Message } from '../models/Message';
import type {
  RoomUser,
  UserWorkspace,
  SharedWorkspaceSnapshot,
  WorkspaceStatusUpdate,
  VoiceParticipant,
  VoiceSignalOffer,
  VoiceSignalAnswer,
  VoiceSignalIceCandidate,
  VoiceMutePayload,
  VoiceSpeakingPayload,
} from '../types/socket.types';

// ─── In-Memory State ────────────────────────────────────────

// Room presence: roomId -> (socketId -> RoomUser)
const roomPresence = new Map<string, Map<string, RoomUser>>();

// Independent workspaces: roomId -> (socketId -> UserWorkspace)
const roomWorkspaces = new Map<string, Map<string, UserWorkspace>>();

// Voice participants: roomId -> (socketId -> VoiceParticipant)
const voiceRooms = new Map<string, Map<string, VoiceParticipant>>();

// ─── Public Helpers ─────────────────────────────────────────

export function getRoomUsers(roomId: string): RoomUser[] {
  const users = roomPresence.get(roomId);
  return users ? Array.from(users.values()) : [];
}

export function getVoiceParticipants(roomId: string): VoiceParticipant[] {
  const participants = voiceRooms.get(roomId);
  return participants ? Array.from(participants.values()) : [];
}

function getWorkspaceStatuses(roomId: string): WorkspaceStatusUpdate[] {
  const wsMap = roomWorkspaces.get(roomId);
  if (!wsMap) return [];
  return Array.from(wsMap.values()).map((ws) => ({
    socketId: ws.socketId,
    username: ws.username,
    isShared: ws.isShared,
    language: ws.language,
    isRunning: ws.isRunning,
    lastVerdict: ws.lastVerdict,
    allowedWriters: ws.allowedWriters,
  }));
}

function getWorkspacePermissions(roomId: string): Record<string, string[]> {
  const wsMap = roomWorkspaces.get(roomId);
  if (!wsMap) return {};
  const perms: Record<string, string[]> = {};
  for (const [sId, ws] of wsMap.entries()) {
    perms[sId] = ws.allowedWriters || [];
  }
  return perms;
}

function getSharedSnapshots(roomId: string): SharedWorkspaceSnapshot[] {
  const wsMap = roomWorkspaces.get(roomId);
  if (!wsMap) return [];
  return Array.from(wsMap.values())
    .filter((ws) => ws.isShared)
    .map((ws) => ({
      socketId: ws.socketId,
      userId: ws.userId,
      username: ws.username,
      color: ws.color,
      code: ws.code,
      language: ws.language,
      allowedWriters: ws.allowedWriters,
      updatedAt: ws.updatedAt,
    }));
}

// ─── Socket Handler ─────────────────────────────────────────

export function registerRoomSocket(io: Server, socket: Socket): void {
  let currentRoomId: string | null = null;
  let currentUser: RoomUser | null = null;
  let currentVoiceState: VoiceParticipant | null = null;

  // Extract auth info
  const token = socket.handshake.auth?.token as string | undefined;
  let userId: string | undefined;
  let username = 'Guest ' + socket.id.slice(-4);

  if (token) {
    try {
      const payload = verifyToken(token);
      userId = payload.userId;
      username = payload.username;
    } catch {
      // Allow connection as guest
    }
  }

  // ─── Leave Helpers ──────────────────────────────────────────

  const leaveVoiceRoom = () => {
    if (!currentRoomId || !currentVoiceState) return;
    const roomId = currentRoomId;

    const vRoom = voiceRooms.get(roomId);
    if (vRoom) {
      vRoom.delete(socket.id);
      if (vRoom.size === 0) voiceRooms.delete(roomId);
    }

    socket.to(roomId).emit('voice:participant-left', { socketId: socket.id });
    console.log(`[Voice] Socket ${socket.id} (${currentUser?.username}) left voice room ${roomId}`);
    currentVoiceState = null;
  };

  const leaveCurrentRoom = () => {
    if (!currentRoomId) return;
    const roomId = currentRoomId;

    leaveVoiceRoom();

    // Clean up workspace — notify others this editor is gone
    const wsMap = roomWorkspaces.get(roomId);
    if (wsMap) {
      const ws = wsMap.get(socket.id);
      if (ws?.isShared) {
        socket.to(roomId).emit('workspace:user-unshared', { socketId: socket.id });
      }
      wsMap.delete(socket.id);
      if (wsMap.size === 0) roomWorkspaces.delete(roomId);
    }

    // Clean up presence
    const roomMap = roomPresence.get(roomId);
    if (roomMap) {
      roomMap.delete(socket.id);
      if (roomMap.size === 0) roomPresence.delete(roomId);
    }

    const remainingUsers = getRoomUsers(roomId);

    socket.to(roomId).emit('room:user-left', {
      socketId: socket.id,
      userId: currentUser?.userId,
      username: currentUser?.username,
      users: remainingUsers,
    });

    socket.leave(roomId);
    currentRoomId = null;
    currentUser = null;
  };

  // ═══════════════════════════════════════════════════════════
  // 1. JOIN ROOM
  // ═══════════════════════════════════════════════════════════
  socket.on('room:join', (payload: { roomId: string; username?: string }) => {
    if (!payload || !payload.roomId || typeof payload.roomId !== 'string' || !payload.roomId.trim()) {
      socket.emit('room:error', { message: 'A valid room ID is required.' });
      return;
    }

    const roomId = payload.roomId.trim();

    if (currentRoomId && currentRoomId !== roomId) {
      leaveCurrentRoom();
    }

    currentRoomId = roomId;
    const effectiveUsername = payload.username?.trim() || username;
    const color = generateUserColor();

    currentUser = {
      socketId: socket.id,
      userId,
      username: effectiveUsername,
      color,
      joinedAt: new Date().toISOString(),
    };

    socket.join(roomId);

    // Register presence
    if (!roomPresence.has(roomId)) roomPresence.set(roomId, new Map());
    roomPresence.get(roomId)!.set(socket.id, currentUser);

    // Create independent workspace for this user (private by default)
    if (!roomWorkspaces.has(roomId)) roomWorkspaces.set(roomId, new Map());
    const workspace: UserWorkspace = {
      socketId: socket.id,
      userId,
      username: effectiveUsername,
      color,
      code: '',
      language: 'javascript',
      isShared: false,
      isRunning: false,
      lastVerdict: null,
      allowedWriters: [],
      updatedAt: new Date().toISOString(),
    };
    roomWorkspaces.get(roomId)!.set(socket.id, workspace);

    const users = getRoomUsers(roomId);
    const workspaceStatuses = getWorkspaceStatuses(roomId);
    const sharedSnapshots = getSharedSnapshots(roomId);
    const activeVoiceParticipants = getVoiceParticipants(roomId);
    const workspacePermissions = getWorkspacePermissions(roomId);

    // Send full state to joining user
    socket.emit('room:joined', {
      roomId,
      user: currentUser,
      users,
      workspaceStatuses,
      sharedSnapshots,
      workspacePermissions,
      voiceParticipants: activeVoiceParticipants,
      message: 'Successfully joined room.',
    });

    // Notify others
    socket.to(roomId).emit('room:user-joined', {
      user: currentUser,
      users,
      workspaceStatus: {
        socketId: socket.id,
        username: effectiveUsername,
        isShared: false,
        language: 'javascript',
        isRunning: false,
        lastVerdict: null,
        allowedWriters: [],
      } as WorkspaceStatusUpdate,
    });

    console.log(`[Socket] User ${effectiveUsername} (${socket.id}) joined room ${roomId}`);
  });

  // ═══════════════════════════════════════════════════════════
  // 2. WORKSPACE: UPDATE OWN CODE (private → only broadcast if shared)
  // ═══════════════════════════════════════════════════════════
  socket.on('workspace:update', (data: { roomId: string; code: string; language?: string }) => {
    if (!data || typeof data.roomId !== 'string' || typeof data.code !== 'string') return;
    const roomId = data.roomId.trim();
    if (!roomId || !socket.rooms.has(roomId)) return;

    const wsMap = roomWorkspaces.get(roomId);
    if (!wsMap) return;

    const ws = wsMap.get(socket.id);
    if (!ws) return;

    ws.code = data.code;
    if (data.language) ws.language = data.language;
    ws.updatedAt = new Date().toISOString();

    // Only broadcast code if this workspace is shared
    if (ws.isShared) {
      socket.to(roomId).emit('workspace:shared-update', {
        socketId: socket.id,
        userId: ws.userId,
        username: ws.username,
        color: ws.color,
        code: ws.code,
        language: ws.language,
        updatedAt: ws.updatedAt,
      } as SharedWorkspaceSnapshot);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 3. WORKSPACE: CHANGE LANGUAGE (independent per user)
  // ═══════════════════════════════════════════════════════════
  socket.on('workspace:language', (data: { roomId: string; language: string }) => {
    if (!data?.roomId || !data?.language) return;
    const roomId = data.roomId.trim();
    if (!roomId || !socket.rooms.has(roomId)) return;

    const wsMap = roomWorkspaces.get(roomId);
    if (!wsMap) return;

    const ws = wsMap.get(socket.id);
    if (!ws) return;

    ws.language = data.language;
    ws.updatedAt = new Date().toISOString();

    // Broadcast language status change to all (so sidebar updates)
    socket.to(roomId).emit('workspace:status-changed', {
      socketId: socket.id,
      username: ws.username,
      isShared: ws.isShared,
      language: ws.language,
      isRunning: ws.isRunning,
      lastVerdict: ws.lastVerdict,
    } as WorkspaceStatusUpdate);
  });

  // ═══════════════════════════════════════════════════════════
  // 4. WORKSPACE: SHARE EDITOR (make code visible to room)
  // ═══════════════════════════════════════════════════════════
  socket.on('workspace:share', (data: { roomId: string }) => {
    if (!data?.roomId) return;
    const roomId = data.roomId.trim();
    if (!roomId || !socket.rooms.has(roomId)) return;

    const wsMap = roomWorkspaces.get(roomId);
    if (!wsMap) return;

    const ws = wsMap.get(socket.id);
    if (!ws) return;

    ws.isShared = true;
    ws.updatedAt = new Date().toISOString();

    // Send snapshot to entire room so they can see the code
    socket.to(roomId).emit('workspace:user-shared', {
      socketId: socket.id,
      userId: ws.userId,
      username: ws.username,
      color: ws.color,
      code: ws.code,
      language: ws.language,
      updatedAt: ws.updatedAt,
    } as SharedWorkspaceSnapshot);

    console.log(`[Workspace] ${ws.username} shared editor in room ${roomId}`);
  });

  // ═══════════════════════════════════════════════════════════
  // 5. WORKSPACE: UNSHARE EDITOR (hide code from room)
  // ═══════════════════════════════════════════════════════════
  socket.on('workspace:unshare', (data: { roomId: string }) => {
    if (!data?.roomId) return;
    const roomId = data.roomId.trim();
    if (!roomId || !socket.rooms.has(roomId)) return;

    const wsMap = roomWorkspaces.get(roomId);
    if (!wsMap) return;

    const ws = wsMap.get(socket.id);
    if (!ws) return;

    ws.isShared = false;
    ws.updatedAt = new Date().toISOString();

    // Notify room to remove this shared editor view
    socket.to(roomId).emit('workspace:user-unshared', {
      socketId: socket.id,
    });

    console.log(`[Workspace] ${ws.username} unshared editor in room ${roomId}`);
  });

  // ═══════════════════════════════════════════════════════════
  // 6. WORKSPACE: RUNNING STATUS (show spinner on sidebar)
  // ═══════════════════════════════════════════════════════════
  socket.on('workspace:running', (data: { roomId: string; isRunning: boolean; lastVerdict?: UserWorkspace['lastVerdict'] }) => {
    if (!data?.roomId) return;
    const roomId = data.roomId.trim();
    if (!roomId || !socket.rooms.has(roomId)) return;

    const wsMap = roomWorkspaces.get(roomId);
    if (!wsMap) return;

    const ws = wsMap.get(socket.id);
    if (!ws) return;

    ws.isRunning = data.isRunning;
    if (data.lastVerdict !== undefined) ws.lastVerdict = data.lastVerdict;

    socket.to(roomId).emit('workspace:status-changed', {
      socketId: socket.id,
      username: ws.username,
      isShared: ws.isShared,
      language: ws.language,
      isRunning: ws.isRunning,
      lastVerdict: ws.lastVerdict,
    } as WorkspaceStatusUpdate);
  });

  // ═══════════════════════════════════════════════════════════
  // 7. WORKSPACE: REQUEST SNAPSHOT (reconnect recovery)
  // ═══════════════════════════════════════════════════════════
  socket.on('workspace:request-snapshot', (data: { roomId: string; targetSocketId: string }) => {
    if (!data?.roomId || !data?.targetSocketId) return;
    const roomId = data.roomId.trim();
    if (!roomId || !socket.rooms.has(roomId)) return;

    const wsMap = roomWorkspaces.get(roomId);
    if (!wsMap) return;

    const targetWs = wsMap.get(data.targetSocketId);
    if (!targetWs || !targetWs.isShared) return;

    socket.emit('workspace:snapshot', {
      socketId: targetWs.socketId,
      userId: targetWs.userId,
      username: targetWs.username,
      color: targetWs.color,
      code: targetWs.code,
      language: targetWs.language,
      allowedWriters: targetWs.allowedWriters,
      updatedAt: targetWs.updatedAt,
    } as SharedWorkspaceSnapshot);
  });

  // ═══════════════════════════════════════════════════════════
  // 8. WORKSPACE: GRANT/REVOKE WRITE PERMISSION (Per-collaborator edit rights)
  // ═══════════════════════════════════════════════════════════
  socket.on(
    'workspace:grant-write',
    (data: { roomId: string; targetSocketId: string; canWrite: boolean }) => {
      if (!data?.roomId || !data?.targetSocketId) return;
      const roomId = data.roomId.trim();
      if (!roomId || !socket.rooms.has(roomId)) return;

      const wsMap = roomWorkspaces.get(roomId);
      if (!wsMap) return;

      const ownerWs = wsMap.get(socket.id);
      if (!ownerWs) return;

      if (!Array.isArray(ownerWs.allowedWriters)) {
        ownerWs.allowedWriters = [];
      }

      if (data.canWrite) {
        if (!ownerWs.allowedWriters.includes(data.targetSocketId)) {
          ownerWs.allowedWriters.push(data.targetSocketId);
        }
      } else {
        ownerWs.allowedWriters = ownerWs.allowedWriters.filter((id) => id !== data.targetSocketId);
      }

      ownerWs.updatedAt = new Date().toISOString();

      // Broadcast permission update to entire room so all clients update their state
      io.to(roomId).emit('workspace:permission-updated', {
        ownerSocketId: socket.id,
        ownerUsername: ownerWs.username,
        targetSocketId: data.targetSocketId,
        canWrite: data.canWrite,
        allowedWriters: ownerWs.allowedWriters,
      });

      console.log(
        `[Workspace Permission] ${ownerWs.username} ${data.canWrite ? 'granted' : 'revoked'} write access for socket ${data.targetSocketId}`
      );
    }
  );

  // ═══════════════════════════════════════════════════════════
  // 9. WORKSPACE: PEER EDIT (Authorized collaborator writes to another user's editor)
  // ═══════════════════════════════════════════════════════════
  socket.on(
    'workspace:peer-edit',
    (data: { roomId: string; ownerSocketId: string; code: string }) => {
      if (!data?.roomId || !data?.ownerSocketId || typeof data.code !== 'string') return;
      const roomId = data.roomId.trim();
      if (!roomId || !socket.rooms.has(roomId)) return;

      const wsMap = roomWorkspaces.get(roomId);
      if (!wsMap) return;

      const ownerWs = wsMap.get(data.ownerSocketId);
      if (!ownerWs) return;

      // Validate that this socket is authorized to write to owner's workspace
      const isAllowed = Array.isArray(ownerWs.allowedWriters) && ownerWs.allowedWriters.includes(socket.id);
      if (!isAllowed) {
        socket.emit('workspace:error', {
          message: 'You do not have write access to this collaborator editor.',
        });
        return;
      }

      // Update owner's workspace code
      ownerWs.code = data.code;
      ownerWs.updatedAt = new Date().toISOString();

      // Broadcast peer code update to everyone in room (including owner, so their editor syncs!)
      io.to(roomId).emit('workspace:peer-code-updated', {
        ownerSocketId: data.ownerSocketId,
        code: data.code,
        editorSocketId: socket.id,
        editorUsername: currentUser?.username || 'Collaborator',
        timestamp: new Date().toISOString(),
      });
    }
  );

  // ═══════════════════════════════════════════════════════════
  // 8. CHAT MESSAGE
  // ═══════════════════════════════════════════════════════════
  socket.on(
    'room:message',
    async (data: {
      roomId: string;
      message: string;
      audioUrl?: string;
      isVoiceTranscribed?: boolean;
    }) => {
      if (!data || typeof data.roomId !== 'string' || typeof data.message !== 'string' || !data.roomId.trim()) {
        socket.emit('room:error', { message: 'A valid room ID and message are required.' });
        return;
      }

      const roomId = data.roomId.trim();
      const content = data.message.trim().substring(0, 2000);
      if (!content && !data.audioUrl) return;

      if (!socket.rooms.has(roomId)) {
        socket.emit('room:error', { message: 'Join the room before sending messages.' });
        return;
      }

      const sender = currentUser ?? {
        socketId: socket.id,
        username: 'Guest',
        color: '#94a3b8',
        joinedAt: new Date().toISOString(),
      };

      const chatPayload = {
        socketId: socket.id,
        userId,
        username: sender.username,
        color: sender.color,
        message: content,
        audioUrl: data.audioUrl,
        isVoiceTranscribed: !!data.isVoiceTranscribed,
        timestamp: new Date().toISOString(),
      };

      io.to(roomId).emit('room:message', chatPayload);

      // Persist to DB
      if (mongoose.connection.readyState === 1) {
        try {
          await Message.create({
            roomId,
            userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
            username: sender.username,
            content: content || '[Voice Note]',
            audioUrl: data.audioUrl,
            isVoiceTranscribed: !!data.isVoiceTranscribed,
            type: 'chat',
          });
        } catch (err) {
          console.error('[Socket] Failed to persist message:', err);
        }
      }
    }
  );

  // ═══════════════════════════════════════════════════════════
  // 9. LEGACY: code:update (kept for backward compat, maps to workspace)
  // ═══════════════════════════════════════════════════════════
  socket.on('code:update', (data: { roomId: string; code: string; language?: string }) => {
    if (!data || typeof data.roomId !== 'string' || typeof data.code !== 'string') return;
    const roomId = data.roomId.trim();
    if (!roomId || !socket.rooms.has(roomId)) return;

    // Map to workspace update
    const wsMap = roomWorkspaces.get(roomId);
    if (wsMap) {
      const ws = wsMap.get(socket.id);
      if (ws) {
        ws.code = data.code;
        if (data.language) ws.language = data.language;
        ws.updatedAt = new Date().toISOString();
      }
    }

    // Legacy broadcast
    socket.to(roomId).emit('code:update', {
      socketId: socket.id,
      username: currentUser?.username,
      code: data.code,
      language: data.language,
      timestamp: new Date().toISOString(),
    });

    updateRoomCode(roomId, data.code, data.language).catch(() => {});
  });

  // ═══════════════════════════════════════════════════════════
  // 10. CURSOR UPDATE
  // ═══════════════════════════════════════════════════════════
  socket.on('cursor:update', (data: { roomId: string; cursor: { lineNumber: number; column: number } }) => {
    if (!data?.roomId || !data?.cursor) return;
    if (!socket.rooms.has(data.roomId)) return;

    socket.to(data.roomId).emit('cursor:update', {
      socketId: socket.id,
      userId,
      username: currentUser?.username,
      color: currentUser?.color,
      cursor: data.cursor,
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 11. YJS CRDT UPDATE
  // ═══════════════════════════════════════════════════════════
  socket.on('yjs:update', (data: { roomId: string; update: number[] | Uint8Array }) => {
    if (!data?.roomId || !data?.update) return;
    if (!socket.rooms.has(data.roomId)) return;

    socket.to(data.roomId).emit('yjs:update', {
      update: data.update,
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 12–17. VOICE SIGNALING (WebRTC)
  // ═══════════════════════════════════════════════════════════
  socket.on('voice:join', (data: { roomId: string }) => {
    if (!data?.roomId) return;
    const roomId = data.roomId.trim();
    if (!roomId || !socket.rooms.has(roomId)) {
      socket.emit('voice:error', { message: 'Must join room before joining voice.' });
      return;
    }

    if (!voiceRooms.has(roomId)) voiceRooms.set(roomId, new Map());

    currentVoiceState = {
      socketId: socket.id,
      userId,
      username: currentUser?.username || username,
      color: currentUser?.color || '#94a3b8',
      isMuted: false,
      isSpeaking: false,
      joinedAt: new Date().toISOString(),
    };
    voiceRooms.get(roomId)!.set(socket.id, currentVoiceState);

    const participants = getVoiceParticipants(roomId);
    const otherParticipants = participants.filter((p) => p.socketId !== socket.id);
    socket.emit('voice:existing-participants', { participants: otherParticipants });
    socket.emit('voice:participant-list', { participants });
    socket.to(roomId).emit('voice:participant-joined', { participant: currentVoiceState });

    console.log(`[Voice] Socket ${socket.id} (${currentUser?.username}) joined voice in room ${roomId}`);
  });

  socket.on('voice:leave', (_data: { roomId: string }) => {
    leaveVoiceRoom();
  });

  socket.on('voice:offer', (data: VoiceSignalOffer) => {
    if (!data?.roomId || !data?.targetSocketId || !data?.offer) return;
    if (!socket.rooms.has(data.roomId)) return;
    io.to(data.targetSocketId).emit('voice:offer', {
      fromSocketId: socket.id,
      senderSocketId: socket.id,
      senderUsername: currentUser?.username,
      offer: data.offer,
    });
  });

  socket.on('voice:answer', (data: VoiceSignalAnswer) => {
    if (!data?.roomId || !data?.targetSocketId || !data?.answer) return;
    if (!socket.rooms.has(data.roomId)) return;
    io.to(data.targetSocketId).emit('voice:answer', {
      fromSocketId: socket.id,
      senderSocketId: socket.id,
      answer: data.answer,
    });
  });

  socket.on('voice:ice-candidate', (data: VoiceSignalIceCandidate) => {
    if (!data?.roomId || !data?.targetSocketId || !data?.candidate) return;
    if (!socket.rooms.has(data.roomId)) return;
    io.to(data.targetSocketId).emit('voice:ice-candidate', {
      fromSocketId: socket.id,
      senderSocketId: socket.id,
      candidate: data.candidate,
    });
  });

  socket.on('voice:mute-state', (data: VoiceMutePayload) => {
    if (!data?.roomId || !currentVoiceState) return;
    if (!socket.rooms.has(data.roomId)) return;
    currentVoiceState.isMuted = data.isMuted;
    const vRoom = voiceRooms.get(data.roomId);
    if (vRoom) vRoom.set(socket.id, currentVoiceState);
    socket.to(data.roomId).emit('voice:mute-state', {
      socketId: socket.id,
      isMuted: data.isMuted,
    });
  });

  socket.on('voice:speaking', (data: VoiceSpeakingPayload) => {
    if (!data?.roomId || !currentVoiceState) return;
    if (!socket.rooms.has(data.roomId)) return;
    currentVoiceState.isSpeaking = data.isSpeaking;
    socket.to(data.roomId).emit('voice:speaking', {
      socketId: socket.id,
      isSpeaking: data.isSpeaking,
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 18. DISCONNECT
  // ═══════════════════════════════════════════════════════════
  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
    leaveCurrentRoom();
  });
}
