export const REALTIME_EVENTS = {
  
  RIDE_OFFER: 'ride:offer',
  RIDE_OFFER_EXPIRED: 'ride:offer_expired',
  RIDE_OFFER_CANCELLED: 'ride:offer_cancelled',


  RIDE_ACCEPTED: 'ride:accepted',
  RIDE_REJECTED: 'ride:rejected',
  RIDE_DRIVER_ASSIGNED: 'ride:driver_assigned',
  RIDE_STATE_CHANGED: 'ride:state_changed',


  DRIVER_ARRIVED:'ride:driver_arrived',
  RIDE_STARTED:'ride:started',
  RIDE_COMPLETED:'ride:completed',
  RIDE_CANCELLED:'ride:cancelled',

  DRIVER_LOCATION: 'driver:location',


  JOIN_RIDE: 'ride:join',
  LEAVE_RIDE: 'ride:leave',
  ACCEPT_RIDE: 'ride:accept',
  REJECT_RIDE: 'ride:reject',
  DRIVER_LOCATION_UPDATE: 'driver:location_update',
} as const;

export const REALTIME_ROOMS = {
  USER: 'user',
  DRIVER: 'driver',
  RIDE: 'ride',
} as const;

export const SOCKET_ROOMS = {
  user: (userId: string | number) =>
    `${REALTIME_ROOMS.USER}:${userId}`,

  driver: (driverId: string | number) =>
    `${REALTIME_ROOMS.DRIVER}:${driverId}`,

  ride: (rideId: string | number) =>
    `${REALTIME_ROOMS.RIDE}:${rideId}`,
} as const;
