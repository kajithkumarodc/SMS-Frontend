import { AxiosError } from 'axios';
import api from '../lib/api';
import { ChildNotFoundError, NoLinkedStudentError } from './portal';

/** A hostel block. Mirrors the backend's `HostelDtos.BlockResponse`. */
export type HostelBlock = {
  id: string;
  name: string;
  createdAt: string; // ISO timestamp
};

/** A room with its live occupancy. Mirrors the backend's `HostelDtos.RoomResponse`. */
export type HostelRoom = {
  id: string;
  blockId: string;
  roomNumber: string;
  capacity: number;
  occupied: number;
  createdAt: string;
};

/** One student in a room (`HostelDtos.RoomStudentView`). */
export type RoomStudent = {
  id: string;
  fullName: string;
  admissionNumber: string;
  sectionId: string | null;
};

/** A student's hostel allocation (`PortalDtos.HostelView` / `HostelAllocation`). */
export type HostelAllocation = {
  blockId: string;
  blockName: string;
  roomId: string;
  roomNumber: string;
  capacity: number;
  roommates: string[];
};

/** All blocks for the caller's tenant, by name. Any authenticated role. */
export async function fetchBlocks(): Promise<HostelBlock[]> {
  const { data } = await api.get<HostelBlock[]>('/v1/hostel/blocks');
  return data;
}

/** Create a block. SCHOOL_ADMIN only server-side. */
export async function createBlock(input: { name: string }): Promise<HostelBlock> {
  const { data } = await api.post<HostelBlock>('/v1/hostel/blocks', input);
  return data;
}

/** Rooms in a block, each with `occupied` / `capacity`. 404 if the block is not in the caller's tenant. */
export async function fetchRooms(blockId: string): Promise<HostelRoom[]> {
  const { data } = await api.get<HostelRoom[]>(`/v1/hostel/blocks/${blockId}/rooms`);
  return data;
}

/** Thrown when a room number is already used within its block (backend 409). */
export class DuplicateRoomNumberError extends Error {
  constructor() {
    super('This room number is already used in this block');
    this.name = 'DuplicateRoomNumberError';
  }
}

/** Thrown when a room is already at full capacity (backend 400). */
export class RoomFullError extends Error {
  constructor() {
    super('This room is already at full capacity');
    this.name = 'RoomFullError';
  }
}

export type AddRoomInput = {
  roomNumber: string;
  capacity: number;
};

/** Add a room to a block. SCHOOL_ADMIN only server-side. 404 if the block is not in the tenant, 409 on a duplicate number. */
export async function addRoom(blockId: string, input: AddRoomInput): Promise<HostelRoom> {
  try {
    const { data } = await api.post<HostelRoom>(`/v1/hostel/blocks/${blockId}/rooms`, input);
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 409) throw new DuplicateRoomNumberError();
    throw error;
  }
}

/** Students allocated to a room. SCHOOL_ADMIN or TEACHER. 404 if the room is not in the tenant / block. */
export async function fetchRoomStudents(blockId: string, roomId: string): Promise<RoomStudent[]> {
  const { data } = await api.get<RoomStudent[]>(`/v1/hostel/blocks/${blockId}/rooms/${roomId}/students`);
  return data;
}

/** Allocate (or, with a null roomId, deallocate) a student's hostel room. SCHOOL_ADMIN only server-side. */
export async function allocateStudentRoom(studentId: string, roomId: string | null): Promise<void> {
  try {
    await api.patch(`/v1/students/${studentId}/hostel-room`, { roomId });
  } catch (error) {
    if ((error as AxiosError).response?.status === 400) throw new RoomFullError();
    throw error;
  }
}

function problemDetail(error: unknown): string {
  const data = (error as AxiosError)?.response?.data as { detail?: string } | undefined;
  return data?.detail ?? '';
}

/**
 * STUDENT: the caller's own hostel allocation, or `null` when they have no room
 * yet. Throws `NoLinkedStudentError` only when no student record is linked.
 */
export async function fetchMyHostel(): Promise<HostelAllocation | null> {
  try {
    const { data } = await api.get<HostelAllocation>('/v1/me/student/hostel');
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 404) {
      if (problemDetail(error).includes('linked to your account')) throw new NoLinkedStudentError();
      return null; // no room allocated
    }
    throw error;
  }
}

/**
 * PARENT: one of the caller's own children's hostel allocation, or `null` when
 * the child has no room yet. Throws `ChildNotFoundError` when the student is not
 * this parent's child.
 */
export async function fetchChildHostel(studentId: string): Promise<HostelAllocation | null> {
  try {
    const { data } = await api.get<HostelAllocation>(`/v1/me/children/${studentId}/hostel`);
    return data;
  } catch (error) {
    if ((error as AxiosError).response?.status === 404) {
      if (problemDetail(error).toLowerCase().includes('child not found')) throw new ChildNotFoundError();
      return null; // no room allocated
    }
    throw error;
  }
}
