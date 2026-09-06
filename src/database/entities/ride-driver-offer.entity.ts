import {Entity, Enum,ManyToOne,PrimaryKey, Property,Unique,} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'crypto';
import { Ride } from './ride.entity';
import { Driver } from './driver.entity';
import { OfferStatus } from '../../shared/types/offer-status.enum';

@Entity({
  tableName: 'ride_driver_offers',
})
@Unique({
  name: 'ride_driver_offers_ride_driver_unique',
  properties: ['ride', 'driver'],
})
export class RideOffer {
  @PrimaryKey({
    type: 'uuid',
  })
  id: string = randomUUID();

  @ManyToOne({
    entity: () => Ride,
    fieldName: 'ride_id',
    deleteRule: 'cascade',
  })
  ride!: Ride;

  @ManyToOne({
    entity: () => Driver,
    fieldName: 'driver_id',
    deleteRule: 'cascade',
  })
  driver!: Driver;

  @Enum({
    items: () => OfferStatus,
    fieldName: 'status',
  })
  status: OfferStatus = OfferStatus.PENDING;

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
    fieldName: 'responded_at',
    type: 'datetime',
    nullable: true,
  })
  respondedAt?: Date;
}
