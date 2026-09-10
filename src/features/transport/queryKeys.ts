/** TanStack Query keys for the transport feature. Append the id where noted. */
export const TRANSPORT_ROUTES_KEY = ['transport', 'routes'] as const;
export const TRANSPORT_VEHICLES_KEY = ['transport', 'vehicles'] as const; // + { routeId }
export const ROUTE_STUDENTS_KEY = ['transport', 'route-students'] as const; // + routeId
export const MY_TRANSPORT_KEY = ['transport', 'mine'] as const;
export const CHILD_TRANSPORT_KEY = ['transport', 'child'] as const; // + studentId
