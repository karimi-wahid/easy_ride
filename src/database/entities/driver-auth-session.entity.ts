import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
} from '@mikro-orm/decorators/legacy';

import { Driver } from './driver.entity';

@Entity({ tableName: 'driver_auth_sessions' })
export class DriverAuthSession {

  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => Driver, {
    fieldName: 'driver_id',
  })
  driver!: Driver;

  @Property({
    fieldName: 'refresh_token_hash',
    type: 'string',
  })
  refreshTokenHash!: string;

  @Property({
    fieldName: 'expires_at',
    type: 'Date',
  })
  expiresAt!: Date;

  @Property({
    fieldName: 'revoked_at',
    type: 'Date',
    nullable: true,
  })
  revokedAt?: Date | null;

  @Property({
    fieldName: 'created_at',
    type: 'Date',
  })
  createdAt: Date = new Date();

  @Property({
    fieldName: 'updated_at',
    type: 'Date',
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}