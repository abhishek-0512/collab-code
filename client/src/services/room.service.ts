import api from './api';
import type { Room, ApiResponse } from '../types';

export async function createRoom(data: {
  name: string;
  description?: string;
  language?: string;
  isPrivate?: boolean;
}): Promise<Room> {
  const res = await api.post<ApiResponse<Room>>('/rooms', data);
  if (!res.data.data) throw new Error(res.data.error || 'Failed to create room');
  return res.data.data;
}

export async function joinRoom(inviteCode: string): Promise<Room> {
  const res = await api.post<ApiResponse<Room>>('/rooms/join', { inviteCode });
  if (!res.data.data) throw new Error(res.data.error || 'Failed to join room');
  return res.data.data;
}

export async function getRoom(roomId: string): Promise<Room> {
  const res = await api.get<ApiResponse<Room>>(`/rooms/${roomId}`);
  if (!res.data.data) throw new Error(res.data.error || 'Room not found');
  return res.data.data;
}

export async function getUserRooms(): Promise<Room[]> {
  const res = await api.get<ApiResponse<Room[]>>('/rooms');
  return res.data.data || [];
}

export async function deleteRoom(roomId: string): Promise<void> {
  await api.delete(`/rooms/${roomId}`);
}
