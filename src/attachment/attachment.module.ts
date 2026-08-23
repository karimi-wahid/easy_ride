import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

import { Attachment } from '../database/entities/attachment.entity';
import { User } from '../database/entities/user.entity';

import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';

import { AttachmentClaimService } from '../shared/service/attachment.service';

import { ObjectStorage } from '../shared/object-storage';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      Attachment,
      User,
    ]),
  ],

  controllers: [
    AttachmentController,
  ],

  providers: [
    AttachmentService,
    AttachmentClaimService,
    ObjectStorage,
  ],

  exports: [
    AttachmentService,
    AttachmentClaimService,
  ],
})
export class AttachmentModule {}