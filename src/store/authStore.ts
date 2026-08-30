import { create } from 'zustand';

export type AuthUser = {
  id: string;
  name: string;
  tenantId: string;
  roles: string[];
};

const USER_KEY = 'auth_user';

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** Record the signed-in user. The access token is held in an httpOnly cookie, not here. */
  login: (user: AuthUser) => void;
  /** Clear local session state. Call the logout endpoint separately to clear the cookie. */
  logout: () => void;
};

const storedUser = readStoredUser();

export const useAuthStore = create<AuthState>((set) => ({
  user: storedUser,
  isAuthenticated: Boolean(storedUser),
  login: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem(USER_KEY);
    set({ user: null, isAuthenticated: false });
  },
}));
