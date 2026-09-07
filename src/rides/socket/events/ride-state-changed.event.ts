export type RideRealtimeStatus =
  | 'REQUESTED'
  | 'SEARCHING'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ARRIVING'
  | 'DRIVER_ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_DRIVER';

export interface RideStateChangedEvent {
  rideId: string;

  previousStatus?: RideRealtimeStatus;

  status: RideRealtimeStatus;

  changedAt: string;
}
