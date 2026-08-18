import {
  Entity,
  PrimaryKey,
  Property,
  ManyToOne,
} from '@mikro-orm/decorators/legacy';
import { User } from './user.entity';

@Entity({ tableName: 'user_session' })
export class UserSession {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @ManyToOne(() => User, {
    fieldName: 'user_id',
    nullable: false,
    deleteRule: 'cascade',
  })
  user!: User;

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