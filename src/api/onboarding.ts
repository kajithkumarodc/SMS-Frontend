import { AxiosError } from 'axios';
import api from '../lib/api';

export type RegisterSchoolInput = {
  schoolName: string;
  schoolIdentifier: string;
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
};

export type RegisterSchoolResponse = {
  tenantId: string;
  schoolName: string;
  schoolIdentifier: string;
  adminEmail: string;
  adminUserId: string;
};

/** Thrown on 409 — the school identifier is already taken. Safe to show inline on that field. */
export class DuplicateSchoolIdentifierError extends Error {
  constructor() {
    super('This school code is already taken — try another');
    this.name = 'DuplicateSchoolIdentifierError';
  }
}

/** Thrown for anything else the form should surface as a top-level error. */
export class RegistrationError extends Error {
  constructor(message = 'Unable to register your school right now. Please try again in a moment.') {
    super(message);
    this.name = 'RegistrationError';
  }
}

export async function registerSchool(input: RegisterSchoolInput): Promise<RegisterSchoolResponse> {
  try {
    const { data } = await api.post<RegisterSchoolResponse>('/v1/onboarding/register-school', input);
    return data;
  } catch (error) {
    const status = (error as AxiosError).response?.status;

    if (status === 409) {
      throw new DuplicateSchoolIdentifierError();
    }
    if (status === 400) {
      // The backend's validation 400 doesn't carry per-field detail (unlike its 409s),
      // so the form's own Zod schema (mirroring the backend's rules) is what actually
      // catches bad input before submit; this is the fallback if that's ever bypassed.
      throw new RegistrationError('Please check the highlighted fields and try again.');
    }
    throw new RegistrationError();
  }
}
