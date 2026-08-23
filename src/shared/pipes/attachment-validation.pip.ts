import {
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

type UploadedAttachmentFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class AttachmentValidationPipe
  implements PipeTransform
{
  transform(
    file: UploadedAttachmentFile | undefined,
  ): UploadedAttachmentFile {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File is empty');
    }

    if (!file.originalname) {
      throw new BadRequestException(
        'File name is required',
      );
    }

    if (!file.mimetype) {
      throw new BadRequestException(
        'File type is required',
      );
    }

    if (!file.size || file.size <= 0) {
      throw new BadRequestException(
        'File size is invalid',
      );
    }

    return file;
  }
}