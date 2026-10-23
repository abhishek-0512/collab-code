import api from './api';
import type { Problem, ApiResponse } from '../types';

export async function getProblems(difficulty?: string): Promise<Problem[]> {
  const params = difficulty ? { difficulty } : {};
  const res = await api.get<ApiResponse<Problem[]>>('/problems', { params });
  return res.data.data || [];
}

export async function getProblem(slug: string): Promise<Problem> {
  const res = await api.get<ApiResponse<Problem>>(`/problems/${slug}`);
  if (!res.data.data) throw new Error('Problem not found');
  return res.data.data;
}

export async function createProblem(data: {
  title: string;
  description: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  constraints?: string;
  examples?: Array<{ input: string; output: string; explanation?: string }>;
}): Promise<Problem> {
  const res = await api.post<ApiResponse<Problem>>('/problems', data);
  if (!res.data.data) throw new Error(res.data.error || 'Failed to create problem');
  return res.data.data;
}
