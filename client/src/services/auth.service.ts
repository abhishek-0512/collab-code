import api from './api';
import type { User, ApiResponse } from '../types';

export interface AuthResponseData {
  token: string;
  user: User;
}

export async function register(username: string, email: string, password: string): Promise<AuthResponseData> {
  const res = await api.post<ApiResponse<AuthResponseData>>('/auth/register', { username, email, password });
  if (!res.data.data) throw new Error(res.data.error || 'Registration failed');
  return res.data.data;
}

export async function login(email: string, password: string): Promise<AuthResponseData> {
  const res = await api.post<ApiResponse<AuthResponseData>>('/auth/login', { email, password });
  if (!res.data.data) throw new Error(res.data.error || 'Login failed');
  return res.data.data;
}

export async function getMe(): Promise<User> {
  const res = await api.get<ApiResponse<User>>('/auth/me');
  if (!res.data.data) throw new Error('Failed to retrieve user profile');
  return res.data.data;
}
