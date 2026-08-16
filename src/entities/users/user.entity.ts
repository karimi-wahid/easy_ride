import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ type: 'number' })
  id!: number;

  @Property({ type: 'string' })
  fullname!: string;

  @Property({ type: 'string' })
  phone!: string;

  @Property({ type: 'Date' })
  createdAt!: Date;

  @Property({ type: 'Date' })
  updatedAt!: Date;
}
