import {
  Entity,
  PrimaryKey,
  Property,
  OneToOne,
  Unique,
} from '@mikro-orm/decorators/legacy';

import { Driver } from './driver.entity';

@Entity({ tableName: 'driver_two_factor' })
@Unique({ properties: ['driver'] })
export class DriverTwoFactor {
  @PrimaryKey({
    type: 'uuid',
    defaultRaw: 'gen_random_uuid()',
  })
  id!: string;

  @OneToOne(() => Driver, {
    fieldName: 'user_id',
    nullable: false,
  })
  driver!: Driver;

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