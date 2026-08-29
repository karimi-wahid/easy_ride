import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
} from '@mikro-orm/decorators/legacy';

import { randomUUID } from 'crypto';
import { RideStatus } from '../../shared/types/ride-status.enum';

@Entity({
  tableName: 'rides',
})
export class Ride {
  @PrimaryKey({
    type: 'uuid',
  })
  id: string = randomUUID();

  @Property({
    fieldName: 'user_id',
    type: 'uuid',
  })
  userId!: string;

  @Property({
    fieldName: 'driver_id',
    type: 'uuid',
    nullable: true,
  })
  driverId: string | null = null;

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

  @Property({
    fieldName: 'estimated_distance_km',
    type: 'number',
    nullable: true,
  })
  estimatedDistanceKm: number | null = null;

  @Property({
    fieldName: 'estimated_duration_minutes',
    type: 'number',
    nullable: true,
  })
  estimatedDurationMinutes: number | null = null;

  @Property({
    fieldName: 'estimated_fare',
    type: 'number',
    nullable: true,
  })
  estimatedFare: number | null = null;

  @Enum({
    items: () => RideStatus,
    fieldName: 'status',
  })
  status: RideStatus = RideStatus.SEARCHING;

  @Property({
    fieldName: 'created_at',
    type: 'datetime',
  })
  createdAt: Date = new Date();

  @Property({
    fieldName: 'updated_at',
    type: 'datetime',
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}
