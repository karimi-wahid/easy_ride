import {Entity, PrimaryKey, Property,Enum,} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'crypto';
import { DriverStatus } from '../../shared/types/driver-status.enum';

@Entity({ tableName: 'drivers' })
export class Driver {
  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({
    type: 'string',
    length: 100,
  })
  fullname!: string;

  @Property({
    type: 'string',
    length: 20,
    unique: true,
  })
  phone!: string;

  @Property({
    type: 'datetime',
    nullable: true,
    fieldName: 'phone_verified_at',
  })
  phoneVerifiedAt?: Date | null;

  @Enum({
    items: () => DriverStatus,
    fieldName: 'status',
  })
  status: DriverStatus = DriverStatus.OFFLINE;

  @Property({
    columnType: 'geography(Point,4326)',
    nullable: true,
  })
  location: string | null = null;

  @Property({
    type: 'datetime',
    nullable: true,
    fieldName: 'last_location_update',
  })
  lastLocationUpdate: Date | null = null;

  @Property({
    type: 'datetime',
    nullable: true,
    fieldName: 'deleted_at',
  })
  deletedAt?: Date | null;

  @Property({
    type: 'datetime',
    fieldName: 'created_at',
  })
  createdAt: Date = new Date();

  @Property({
    type: 'datetime',
    onUpdate: () => new Date(),
    fieldName: 'updated_at',
  })
  updatedAt: Date = new Date();
}
