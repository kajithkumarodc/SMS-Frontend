import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  // Send/receive the httpOnly auth cookie. Required for credentialed
  // cross-origin requests; harmless same-origin (through the Vite proxy).
  withCredentials: true,
});

// The access token lives in an httpOnly cookie the browser attaches
// automatically — no Authorization header is set from JS.

// If the cookie is missing/expired the API answers 401. Drop the local
// session so the UI stops showing a signed-in state; the login route guard
// takes over from there. The login call handles its own 401 before this runs.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? '';

    if (status === 401 && !url.includes('/auth/login') && useAuthStore.getState().isAuthenticated) {
      useAuthStore.getState().logout();
    }

    return Promise.reject(error);
  },
);

export default api;
