import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setUser: (user: User) => void;
}

const storedToken = localStorage.getItem('collab_token');
let storedUser: User | null = null;
try {
  const raw = localStorage.getItem('collab_user');
  if (raw) storedUser = JSON.parse(raw);
} catch {
  // Ignored
}

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser,
  token: storedToken,
  isAuthenticated: !!storedToken,
  isLoading: false,
  setAuth: (user, token) => {
    localStorage.setItem('collab_token', token);
    localStorage.setItem('collab_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },
  clearAuth: () => {
    localStorage.removeItem('collab_token');
    localStorage.removeItem('collab_user');
    set({ user: null, token: null, isAuthenticated: false });
  },
  setUser: (user) => {
    localStorage.setItem('collab_user', JSON.stringify(user));
    set({ user });
  },
}));
