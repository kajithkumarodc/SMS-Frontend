import { AxiosError } from 'axios';
import api from '../lib/api';
import { ChildNotFoundError, NoLinkedStudentError } from './portal';

/** A transport route. Mirrors the backend's `TransportDtos.RouteResponse`. */
export type TransportRoute = {
  id: string;
  name: string;
  createdAt: string; // ISO timestamp
};

/** A vehicle. Mirrors the backend's `TransportDtos.VehicleResponse`. */
export type TransportVehicle = {
  id: string;
  routeId: string | null;
  registrationNumber: string;
  driverName: string;
  driverContact: string | null;
  capacity: number;
  createdAt: string;
};

/** One student on a route (`TransportDtos.RouteStudentView`). */
export type RouteStudent = {
  id: string;
  fullName: string;
  admissionNumber: string;
  sectionId: string | null;
};

/** A student's transport assignment (`PortalDtos.TransportView` / `TransportAssignment`). */
export type TransportAssignment = {
  routeId: string;
  routeName: string;
  vehicles: {
    registrationNumber: string;
    driverName: string;
    driverContact: string | null;
    capacity: number;
  }[];
};

/** All routes for the caller's tenant, by name. Any authenticated role. */
export async function fetchRoutes(): Promise<TransportRoute[]> {
  const { data } = await api.get<TransportRoute[]>('/v1/transport/routes');
  return data;
}

/** Create a route. SCHOOL_ADMIN only server-side. */
export async function createRoute(input: { name: string }): Promise<TransportRoute> {
  const { data } = await api.post<TransportRoute>('/v1/transport/routes', input);
  return data;
}

/** Vehicles for the caller's tenant, optionally filtered to one route. */
export async function fetchVehicles(routeId?: string): Promise<TransportVehicle[]> {
  const { data } = await api.get<TransportVehicle[]>('/v1/transport/vehicles', {
    params: routeId ? { routeId } : undefined,
  });
  return data;
}

/** Thrown when a vehicle's registration number is already used in the tenant (backend 409). */
export class DuplicateRegistrationNumberError extends Error {
  constructor() {
    super('This registration number is already in use');
    this.name = 'DuplicateRegistrationNumberError';
  }
}

export type AddVehicleInput = {
  registrationNumber: string;
  driverName: string;
  driverContact?: string | null;
  capacity: number;
  routeId?: string | null;
};

/** Add a vehicle. SCHOOL_ADMIN only server-side. 404 if `routeId` is not in the tenant, 409 on a duplicate registration. */
export async function addVehicle(input: AddVehicleInput): Promise<TransportVehicle> {
  try {
    const { data } = await api.post<TransportVehicle>('/v1/transport/vehicles', input);
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 409) throw new DuplicateRegistrationNumberError();
    throw error;
  }
}

/** Students assigned to a route. SCHOOL_ADMIN or TEACHER. 404 if the route is not in the caller's tenant. */
export async function fetchRouteStudents(routeId: string): Promise<RouteStudent[]> {
  const { data } = await api.get<RouteStudent[]>(`/v1/transport/routes/${routeId}/students`);
  return data;
}

/** Assign (or, with a null routeId, unassign) a student's transport route. SCHOOL_ADMIN only server-side. */
export async function assignStudentRoute(
  studentId: string,
  routeId: string | null,
): Promise<void> {
  await api.patch(`/v1/students/${studentId}/transport-route`, { routeId });
}

function problemDetail(error: unknown): string {
  const data = (error as AxiosError)?.response?.data as { detail?: string } | undefined;
  return data?.detail ?? '';
}

/**
 * STUDENT: the caller's own transport assignment, or `null` when they aren't on a
 * route yet. Throws `NoLinkedStudentError` only when no student record is linked.
 */
export async function fetchMyTransport(): Promise<TransportAssignment | null> {
  try {
    const { data } = await api.get<TransportAssignment>('/v1/me/student/transport');
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 404) {
      if (problemDetail(error).includes('linked to your account')) throw new NoLinkedStudentError();
      return null; // no route assigned
    }
    throw error;
  }
}

/**
 * PARENT: one of the caller's own children's transport assignment, or `null` when
 * the child isn't on a route yet. Throws `ChildNotFoundError` when the student is
 * not this parent's child.
 */
export async function fetchChildTransport(studentId: string): Promise<TransportAssignment | null> {
  try {
    const { data } = await api.get<TransportAssignment>(`/v1/me/children/${studentId}/transport`);
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 404) {
      if (problemDetail(error).toLowerCase().includes('child not found')) throw new ChildNotFoundError();
      return null; // no route assigned
    }
    throw error;
  }
}
