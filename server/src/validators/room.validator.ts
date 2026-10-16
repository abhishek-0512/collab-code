import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(80, 'Room name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  language: z.enum(['javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust']).default('javascript'),
  isPrivate: z.boolean().default(true),
  problemId: z.string().optional(),
});

export const joinRoomSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
