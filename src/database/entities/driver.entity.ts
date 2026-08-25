import {
  Entity,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'crypto';

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

  @Property({
    type: 'datetime',
    nullable: true,
    fieldName: 'deleted_at',
  })
  deletedAt?: Date | null;

  @Property({
    type: 'number',
    nullable: true,
    fieldName: 'attachment_id',
  })
  attachmentId?: string | null;

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