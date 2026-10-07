import { isAxiosError } from 'axios';

/** The backend's problem+json `detail`, when it sent one (400/404/409 validation messages). */
export function serverMessage(error: unknown): string | undefined {
  if (isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string' && detail) return detail;
  }
  return undefined;
}
