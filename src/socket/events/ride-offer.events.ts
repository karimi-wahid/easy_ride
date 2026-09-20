export interface RideOfferEvent {
  offerId: string;
  rideId: string;

  pickup: {
    latitude: number;
    longitude: number;
  };

  destination: {
    latitude: number;
    longitude: number;
  };

  geometry?: {
    type: 'LineString';
    coordinates: number[][];
  };

  estimatedDistance?: number;
  estimatedDuration?: number;
  estimatedPrice?: number;

  expiresAt: string;
}
