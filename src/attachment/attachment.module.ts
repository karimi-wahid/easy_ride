import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Attachment } from '../database/entities/attachment.entity';
import { AttachmentController } from './attachment.controller';
import { AttachmentService } from './attachment.service';
import { ObjectStorage } from '../shared/object-storage';


@Module({
  imports: [MikroOrmModule.forFeature([Attachment])],
  controllers: [AttachmentController],
  providers: [AttachmentService, ObjectStorage],
  exports: [AttachmentService],
})
export class AttachmentModule {}