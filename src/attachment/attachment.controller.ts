import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AttachmentService } from './attachment.service';
import { AttachmentValidationPipe } from '../shared/pipes/attachment-validation.pip';

type UploadedAttachmentFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Controller('attachments')
export class AttachmentController {
  constructor(
    private readonly attachmentService: AttachmentService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @UploadedFile(new AttachmentValidationPipe())
    file: UploadedAttachmentFile,
  ) {
    return this.attachmentService.create(file);
  }
}