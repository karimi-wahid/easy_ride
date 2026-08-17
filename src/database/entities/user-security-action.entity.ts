import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
} from '@mikro-orm/decorators/legacy';

import { User } from './user.entity';

@Entity({ tableName: 'user_security_action' })
export class UserSecurityAction {
  @PrimaryKey({
    type: 'uuid',
    defaultRaw: 'gen_random_uuid()',
  })
  id!: string;

  @ManyToOne(() => User, {
    fieldName: 'user_id',
    nullable: true,
    deleteRule: 'cascade',
  })
  user: User | null = null;

  @Property({
    type: 'datetime',
    nullable: true,
  })
  usedAt: Date | null = null;

  @Property({
    type: 'datetime',
  })
  expiresAt!: Date;

  @Property({
    type: 'string',
    length: 255,
  })
  secret!: string;

  @Property({
    type: 'string',
    length: 50,
  })
  eventType!: string;

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
    type: 'text',
    nullable: true,
  })
  metadata: string | null = null;

  @Property({
    type: 'datetime',
  })
  createdAt: Date = new Date();
}