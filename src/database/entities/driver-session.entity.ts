import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
} from '@mikro-orm/decorators/legacy';
import { Driver } from './driver.entity';

@Entity({ tableName: 'driver_session' })
export class DriverSession {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => Driver, {
    fieldName: 'driver_id',
    nullable: false,
    deleteRule: 'cascade',
  })
  driver!: Driver;

  @Property({
    type: 'string',
    length: 255,
    unique: true,
  })
  refreshTokenHash!: string;

  @Property({
    type: 'datetime',
  })
  expiresAt!: Date;

  @Property({
    type: 'datetime',
    nullable: true,
  })
  revokedAt: Date | null = null;

  @Property({
    type: 'string',
    length: 45,
    nullable: true,
  })
  ipAddress: string | null = null;

  @Property({
    type: 'text',
    nullable: true,
  })
  userAgent: string | null = null;

  @Property({
    type: 'datetime',
  })
  createdAt: Date = new Date();
}