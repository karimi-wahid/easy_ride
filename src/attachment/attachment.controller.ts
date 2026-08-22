import {Controller,Delete,Get,Param,Post,Res,UploadedFile,UseInterceptors,} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AttachmentService } from './attachment.service';

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
    @UploadedFile() file: UploadedAttachmentFile,
  ) {
    return this.attachmentService.create(file);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.attachmentService.getById(Number(id));
  }

  @Post(':id/claim')
  async claim(@Param('id') id: string) {
    return this.attachmentService.claim(Number(id));
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.attachmentService.delete(Number(id));
    return {
      success: true,
    };
  }

  @Get(':id/file')
  async getFile(
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const { attachment, object } =
      await this.attachmentService.getFile(Number(id));

    if (!object.Body) {
      return response.status(404).json({
        message: 'File not found',
      });
    }
    response.setHeader(
      'Content-Type',
      attachment.imageType,
    );
    if (object.ContentLength !== undefined) {
      response.setHeader(
        'Content-Length',
        object.ContentLength.toString(),
      );
    }

    const body = object.Body as NodeJS.ReadableStream;
    body.pipe(response);
  }
}