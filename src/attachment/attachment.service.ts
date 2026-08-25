import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EntityManager,
  EntityRepository,
} from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { randomUUID } from 'crypto';

import { Attachment } from '../database/entities/attachment.entity';
import { ObjectStorage } from '../shared/object-storage';

type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class AttachmentService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Attachment)
    private readonly attachmentRepository: EntityRepository<Attachment>,
    private readonly objectStorage: ObjectStorage,
  ) {}

  async create(file: UploadedFile): Promise<Attachment> {
    const objectKey = `attachments/${randomUUID()}`;

    await this.objectStorage.upload(
      objectKey,
      file.buffer,
      file.mimetype,
    );

    try {
      const attachment = new Attachment();

      attachment.imageName = file.originalname;
      attachment.imageType = file.mimetype;
      attachment.objectKey = objectKey;

      this.em.persist(attachment);
      await this.em.flush();

      return attachment;
    } catch (error) {
      try {
        await this.objectStorage.delete(objectKey);
      } catch {
        // Ignore cleanup error.
      }

      throw error;
    }
  }

  async getByUid(uid: string): Promise<Attachment> {
    const attachment =
      await this.attachmentRepository.findOne({ uid });

    if (!attachment) {
      throw new NotFoundException(
        'Attachment not found',
      );
    }

    return attachment;
  }

  async delete(uid: string): Promise<void> {
    const attachment = await this.getByUid(uid);

    await this.objectStorage.delete(
      attachment.objectKey,
    );

    this.em.remove(attachment);
    await this.em.flush();
  }

  async getFile(uid: string) {
    const attachment = await this.getByUid(uid);

    const object = await this.objectStorage.get(
      attachment.objectKey,
    );

    return {
      attachment,
      object,
    };
  }
}