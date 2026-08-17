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
  passwordHash!: string;

  @Property({
    fieldName: 'phone_verified_at',
    type: 'Date',
    nullable: true,
  })
  phoneVerifiedAt?: Date;

  @Property({
    fieldName: 'two_factor_enabled',
    type: 'boolean',
  })
  twoFactorEnabled: boolean = false;

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



user_security_actions

