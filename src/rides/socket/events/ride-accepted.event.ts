export interface RideAcceptedEvent {
  rideId: string;

  driver: {
    id: string;
    name?: string;
    rating?: number;

    vehicle?: {
      id?: string;
      make?: string;
      model?: string;
      color?: string;
      plateNumber?: string;
    };
  };

  acceptedAt: string;
}
