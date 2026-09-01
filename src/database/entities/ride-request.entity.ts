import {
  Entity,
  PrimaryKey,
  Property,
  Enum,
} from '@mikro-orm/decorators/legacy';

import { randomUUID } from 'crypto';
import { RideRequestStatus } from '../../shared/types/ride-request-status.enum';

@Entity({
  tableName: 'ride_requests',
})
export class RideRequest {
  @PrimaryKey({
    type: 'uuid',
  })
  id: string = randomUUID();

  @Property({
    fieldName: 'ride_id',
    type: 'uuid',
  })
  rideId!: string;

  @Property({
    fieldName: 'driver_id',
    type: 'uuid',
  })
  driverId!: string;

  @Enum({
    fieldName: 'status',
    items: () => RideRequestStatus,
  })
  status: RideRequestStatus =
    RideRequestStatus.PENDING;

  @Property({
    fieldName: 'expires_at',
    type: 'datetime',
  })
  expiresAt!: Date;

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
