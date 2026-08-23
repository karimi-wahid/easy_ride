import {
  Entity,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { randomUUID } from 'crypto';

@Entity({ tableName: 'attachments' })
export class Attachment {
  @PrimaryKey({ type: 'uuid' })
  uid: string = randomUUID();

  @Property({ type: 'string' })
  imageName!: string;

  @Property({ type: 'string' })
  imageType!: string;

  @Property({ type: 'string' })
  objectKey!: string;

  @Property({ type: 'Date' })
  createdAt: Date = new Date();

  @Property({
    type: 'Date',
    nullable: true,
  })
  claimedAt?: Date | null;
}