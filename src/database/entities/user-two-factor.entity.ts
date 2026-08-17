import {
  Entity,
  PrimaryKey,
  Property,
  OneToOne,
  Unique,
} from '@mikro-orm/decorators/legacy';

import { User } from './user.entity';

@Entity({ tableName: 'user_two_factor' })
@Unique({ properties: ['user'] })
export class UserTwoFactor {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @OneToOne(() => User, {
    fieldName: 'user_id',
    nullable: false,
  })
  user!: User;

  @Property({
    type: 'datetime',
    nullable: true,
  })
  enabled: Date | null = null;

  @Property({
    type: 'string',
    length: 255,
  })
  secret!: string;

  @Property({
    type: 'datetime',
  })
  createdAt: Date = new Date();

  @Property({
    type: 'datetime',
    onUpdate: () => new Date(),
  })
  updatedAt: Date = new Date();
}