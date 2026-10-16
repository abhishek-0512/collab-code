import { Response } from 'express';
import type { AuthenticatedRequest } from '../types';
import * as authService from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/apiResponse';

export async function register(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await authService.registerUser(req.body);
    sendSuccess(res, result, 'Registration successful', 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed';
    sendError(res, message, 400);
  }
}

export async function login(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const result = await authService.loginUser(req.body);
    sendSuccess(res, result, 'Login successful');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed';
    sendError(res, message, 401);
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }
    const user = await authService.getUserById(req.user.userId);
    sendSuccess(res, user);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'User not found';
    sendError(res, message, 404);
  }
}
