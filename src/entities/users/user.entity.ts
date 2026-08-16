import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ type: 'number' })
  id!: number;

  @Property({ type: 'string' })
  fullname!: string;

  @Property({ type: 'string' })
  phone!: string;

  @Property({
    fieldName: 'password_hash',
    type: 'string',
  })
  passwordHash?: string;

  @Property({
    fieldName: 'created_at',
    type: 'Date',
  })
  createdAt!: Date;

  @Property({
    fieldName: 'updated_at',
    type: 'Date',
  })
  updatedAt!: Date;
}
