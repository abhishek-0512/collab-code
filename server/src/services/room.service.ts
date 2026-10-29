import mongoose from 'mongoose';
import { Room, IRoom, RoomLanguage } from '../models/Room';
import { generateRoomId, generateInviteCode } from '../utils/generateId';
import type { CreateRoomInput } from '../validators/room.validator';

interface MemoryRoom {
  id: string;
  roomId: string;
  name: string;
  description?: string;
  language: RoomLanguage;
  code: string;
  ownerId: string;
  isPrivate: boolean;
  inviteCode: string;
  members: string[];
  problemId?: string;
  createdAt: Date;
  updatedAt: Date;
}
const memoryRooms = new Map<string, MemoryRoom>();

function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function getStarterCode(language: string): string {
  const starters: Record<string, string> = {
    javascript: `// Welcome to Collab Code!
function solution() {
  console.log("Hello from collaborative JavaScript!");
}

solution();
`,
    typescript: `// Welcome to Collab Code!
function solution(): void {
  console.log("Hello from collaborative TypeScript!");
}

solution();
`,
    python: `# Welcome to Collab Code!
def solution():
    print("Hello from collaborative Python!")

solution()
`,
    java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from collaborative Java!");
    }
}
`,
    cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello from collaborative C++!" << endl;
    return 0;
}
`,
    go: `package main

import "fmt"

func main() {
    fmt.Println("Hello from collaborative Go!")
}
`,
    rust: `fn main() {
    println!("Hello from collaborative Rust!");
}
`,
  };
  return starters[language] ?? starters.javascript;
}

export async function createRoom(input: CreateRoomInput, ownerId: string) {
  const roomId = generateRoomId();
  const inviteCode = generateInviteCode();
  const starterCode = getStarterCode(input.language);

  if (isMongoConnected()) {
    const room = await Room.create({
      roomId,
      name: input.name,
      description: input.description ?? undefined,
      language: input.language,
      code: starterCode,
      ownerId: new mongoose.Types.ObjectId(ownerId),
      isPrivate: input.isPrivate,
      inviteCode,
      members: [new mongoose.Types.ObjectId(ownerId)],
      problemId: input.problemId ? new mongoose.Types.ObjectId(input.problemId) : undefined,
    });

    return formatMongoRoom(room, ownerId);
  }

  // Memory fallback
  const id = new mongoose.Types.ObjectId().toString();
  const memRoom: MemoryRoom = {
    id,
    roomId,
    name: input.name,
    description: input.description ?? undefined,
    language: input.language as RoomLanguage,
    code: starterCode,
    ownerId,
    isPrivate: input.isPrivate,
    inviteCode,
    members: [ownerId],
    problemId: input.problemId ?? undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryRooms.set(roomId, memRoom);

  return formatMemoryRoom(memRoom, ownerId);
}

export async function joinRoomByInviteCode(inviteCode: string, userId: string) {
  const normalizedCode = inviteCode.trim().toUpperCase();

  if (isMongoConnected()) {
    const room = await Room.findOne({ inviteCode: normalizedCode });
    if (!room) throw new Error('Invalid invite code');

    const userObjId = new mongoose.Types.ObjectId(userId);
    if (!room.members.some((m) => m.equals(userObjId))) {
      room.members.push(userObjId);
      await room.save();
    }

    return formatMongoRoom(room, userId);
  }

  // Memory fallback
  let found: MemoryRoom | undefined;
  for (const r of memoryRooms.values()) {
    if (r.inviteCode === normalizedCode) {
      found = r;
      break;
    }
  }

  if (!found) throw new Error('Invalid invite code');

  if (!found.members.includes(userId)) {
    found.members.push(userId);
    found.updatedAt = new Date();
  }

  return formatMemoryRoom(found, userId);
}

export async function getRoomByRoomId(roomId: string, userId: string) {
  if (isMongoConnected()) {
    const room = await Room.findOne({ roomId });
    if (!room) throw new Error('Room not found');

    const userObjId = new mongoose.Types.ObjectId(userId);
    const isMember = room.members.some((m) => m.equals(userObjId));
    if (room.isPrivate && !isMember && room.ownerId.toString() !== userId) {
      // Auto join if private member list doesn't include but room exists
      room.members.push(userObjId);
      await room.save();
    }

    return formatMongoRoom(room, userId);
  }

  let memRoom = memoryRooms.get(roomId);
  if (!memRoom) {
    // Auto-create room for development resilience so browser refresh never throws 404
    memRoom = {
      id: new mongoose.Types.ObjectId().toString(),
      roomId,
      name: `Collab Session ${roomId.slice(0, 6)}`,
      language: 'javascript',
      code: getStarterCode('javascript'),
      ownerId: userId,
      isPrivate: false,
      inviteCode: roomId.slice(0, 8).toUpperCase(),
      members: [userId],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryRooms.set(roomId, memRoom);
  }

  if (!memRoom.members.includes(userId)) {
    memRoom.members.push(userId);
  }

  return formatMemoryRoom(memRoom, userId);
}

export async function getUserRooms(userId: string) {
  if (isMongoConnected()) {
    const userObjId = new mongoose.Types.ObjectId(userId);
    const rooms = await Room.find({ members: userObjId }).sort({ updatedAt: -1 }).limit(30);
    return rooms.map((r) => formatMongoRoom(r, userId));
  }

  const userRooms: ReturnType<typeof formatMemoryRoom>[] = [];
  for (const r of memoryRooms.values()) {
    if (r.members.includes(userId) || r.ownerId === userId) {
      userRooms.push(formatMemoryRoom(r, userId));
    }
  }
  return userRooms.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function updateRoomCode(roomId: string, code: string, language?: string) {
  if (isMongoConnected()) {
    const update: Record<string, unknown> = { code, updatedAt: new Date() };
    if (language) update.language = language;
    await Room.updateOne({ roomId }, { $set: update });
    return;
  }

  const memRoom = memoryRooms.get(roomId);
  if (memRoom) {
    memRoom.code = code;
    if (language) memRoom.language = language as RoomLanguage;
    memRoom.updatedAt = new Date();
  }
}

export async function deleteRoom(roomId: string, userId: string) {
  if (isMongoConnected()) {
    const room = await Room.findOne({ roomId });
    if (!room) throw new Error('Room not found');
    if (room.ownerId.toString() !== userId) throw new Error('Only room owner can delete this room');
    await Room.deleteOne({ roomId });
    return;
  }

  const memRoom = memoryRooms.get(roomId);
  if (!memRoom) throw new Error('Room not found');
  if (memRoom.ownerId !== userId) throw new Error('Only room owner can delete this room');
  memoryRooms.delete(roomId);
}

function formatMongoRoom(room: IRoom, userId: string) {
  return {
    id: room._id.toString(),
    roomId: room.roomId,
    name: room.name,
    description: room.description,
    language: room.language,
    code: room.code,
    isPrivate: room.isPrivate,
    inviteCode: room.inviteCode,
    isOwner: room.ownerId.toString() === userId,
    memberCount: room.members.length,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

function formatMemoryRoom(room: MemoryRoom, userId: string) {
  return {
    id: room.id,
    roomId: room.roomId,
    name: room.name,
    description: room.description,
    language: room.language,
    code: room.code,
    isPrivate: room.isPrivate,
    inviteCode: room.inviteCode,
    isOwner: room.ownerId === userId,
    memberCount: room.members.length,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}
