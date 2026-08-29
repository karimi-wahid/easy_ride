import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
} from '@mikro-orm/decorators/legacy';

import { randomUUID } from 'crypto';

export enum RideStatus {
  SEARCHING = 'searching',
  ACCEPTED = 'accepted',
  DRIVER_ARRIVING = 'driver_arriving',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity({
  tableName: 'rides',
})
export class Ride {
  @PrimaryKey({
    type: 'uuid',
  })
  id: string = randomUUID();

  // User who requested the ride
  @Property({
    fieldName: 'user_id',
    type: 'uuid',
  })
  userId!: string;

  // Driver who accepted the ride
  @Property({
    fieldName: 'driver_id',
    type: 'uuid',
    nullable: true,
  })
  driverId: string | null = null;

  // Pickup location
  @Property({
    fieldName: 'pickup_lat',
    type: 'number',
  })
  pickupLat!: number;

  @Property({
    fieldName: 'pickup_lng',
    type: 'number',
  })
  pickupLng!: number;

  // Destination location
  @Property({
    fieldName: 'destination_lat',
    type: 'number',
  })
  destinationLat!: number;

  @Property({
    fieldName: 'destination_lng',
    type: 'number',
  })
  destinationLng!: number;

  // Estimated distance in kilometers
  @Property({
    fieldName: 'estimated_distance_km',
    type: 'number',
    nullable: true,
  })
  estimatedDistanceKm: number | null = null;

  // Estimated trip duration in minutes
  @Property({
    fieldName: 'estimated_duration_minutes',
    type: 'number',
    nullable: true,
  })
  estimatedDurationMinutes: number | null = null;

  // Estimated fare
  @Property({
    fieldName: 'estimated_fare',
    type: 'number',
    nullable: true,
  })
  estimatedFare: number | null = null;

  // Current ride status
  @Enum({
    items: () => RideStatus,
    fieldName: 'status',
  })
  status: RideStatus = RideStatus.SEARCHING;

  // Created timestamp
  @Property({
    fieldName: 'created_at',
    type: 'datetime',
  })
  createdAt: Date = new Date();

  // Updated timestamp
  @Property({
    fieldName: 'updated_at',
    type: 'datetime',
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
