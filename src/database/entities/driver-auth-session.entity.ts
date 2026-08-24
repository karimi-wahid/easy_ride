import {
  Entity,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'driver_auth_sessions' })
export class DriverAuthSession {
  @PrimaryKey({ type: 'number' })
  id!: number;

  @Property({
    fieldName: 'driver_id',
    type: 'number',
  })
  userId!: number;

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
  revokedAt?: Date;

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