import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().trim().min(1, 'Room name is required').max(150, 'Room name too long'),
  description: z.string().max(2000, 'Description too long').nullish().or(z.literal('')),
  language: z.preprocess((val) => (val === 'c++' ? 'cpp' : val), z.enum(['javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust'])).default('javascript'),
  isPrivate: z.union([z.boolean(), z.string().transform((v) => v === 'true')]).default(true),
  problemId: z.string().nullish().or(z.literal('')),
});

export const joinRoomSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
