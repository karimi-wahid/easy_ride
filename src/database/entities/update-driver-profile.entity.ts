import { Entity, PrimaryKey, Property } from "@mikro-orm/decorators/legacy";

@Entity()
export class Driver {
  @PrimaryKey()
  id!: number;

  @Property()
  phone!: string;

  @Property()
  fullname!: string;
}