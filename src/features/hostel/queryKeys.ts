/** TanStack Query keys for the hostel feature. Append the id where noted. */
export const HOSTEL_BLOCKS_KEY = ['hostel', 'blocks'] as const;
export const BLOCK_ROOMS_KEY = ['hostel', 'rooms'] as const; // + blockId
export const ROOM_STUDENTS_KEY = ['hostel', 'room-students'] as const; // + roomId
export const MY_HOSTEL_KEY = ['hostel', 'mine'] as const;
export const CHILD_HOSTEL_KEY = ['hostel', 'child'] as const; // + studentId
