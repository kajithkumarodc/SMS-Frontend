/** TanStack Query keys for the staff + payroll features. Append the id/filter where noted. */
export const STAFF_PROFILES_KEY = ['staff', 'profiles'] as const;
export const ELIGIBLE_USERS_KEY = ['staff', 'eligible-users'] as const;
export const LEAVE_REQUESTS_KEY = ['staff', 'leave-requests'] as const; // + { staffUserId?, status? }
export const OWN_LEAVE_REQUESTS_KEY = ['staff', 'leave-requests', 'mine'] as const;
export const OWN_STAFF_PROFILE_KEY = ['staff', 'profile', 'mine'] as const;
export const OWN_PAYROLL_KEY = ['payroll', 'mine'] as const;
