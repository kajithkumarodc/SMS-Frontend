import { create } from 'zustand';

type AuthState = {
  user: unknown | null;
  token: string | null;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>(() => ({
  user: null,
  token: null,
  isAuthenticated: false,
  login: () => undefined,
  logout: () => undefined,
}));
