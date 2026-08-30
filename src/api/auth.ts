import { AxiosError } from 'axios';
import api from '../lib/api';
import type { AuthUser } from '../store/authStore';

export type LoginCredentials = {
  schoolIdentifier: string;
  email: string;
  password: string;
};

type LoginResponseBody = {
  token: string;
  user: AuthUser;
};

/** Thrown for a rejected sign-in. `message` is safe to show to the user. */
export class LoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoginError';
  }
}

const GENERIC_MESSAGE = 'Invalid email or password';

/**
 * Authenticate. On success the backend sets an httpOnly access-token cookie;
 * this returns only the user object for the UI.
 */
export async function login({
  schoolIdentifier,
  email,
  password,
}: LoginCredentials): Promise<AuthUser> {
  try {
    const { data } = await api.post<LoginResponseBody>('/v1/auth/login', {
      schoolIdentifier,
      email,
      password,
    });

    return data.user;
  } catch (error) {
    const status = (error as AxiosError).response?.status;

    if (status === 401 || status === 400) {
      throw new LoginError(GENERIC_MESSAGE);
    }

    throw new LoginError('Unable to sign in right now. Please try again in a moment.');
  }
}

/** Clear the access-token cookie server-side. Never throws. */
export async function logout(): Promise<void> {
  try {
    await api.post('/v1/auth/logout');
  } catch {
    // Best effort — the local session is cleared regardless.
  }
}
