import { Response } from 'express';
import type { AuthenticatedRequest } from '../types';
import * as roomService from '../services/room.service';
import { sendSuccess, sendError } from '../utils/apiResponse';

export async function createRoom(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    const room = await roomService.createRoom(req.body, req.user.userId);
    sendSuccess(res, room, 'Room created successfully', 201);
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Failed to create room', 400);
  }
}

export async function joinRoom(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    const room = await roomService.joinRoomByInviteCode(req.body.inviteCode, req.user.userId);
    sendSuccess(res, room, 'Successfully joined room');
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Failed to join room', 404);
  }
}

export async function getRoom(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    const room = await roomService.getRoomByRoomId(req.params.roomId as string, req.user.userId);
    sendSuccess(res, room);
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Room not found', 404);
  }
}

export async function getUserRooms(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    const rooms = await roomService.getUserRooms(req.user.userId);
    sendSuccess(res, rooms);
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Failed to retrieve sessions', 400);
  }
}

export async function deleteRoom(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    await roomService.deleteRoom(req.params.roomId as string, req.user.userId);
    sendSuccess(res, null, 'Room deleted successfully');
  } catch (err) {
    sendError(res, err instanceof Error ? err.message : 'Failed to delete room', 403);
  }
}
