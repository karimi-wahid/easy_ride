import {BadRequestException,Injectable,NotFoundException,}from '@nestjs/common';
import {EntityManager,EntityRepository,} from '@mikro-orm/postgresql';
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
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('File is empty');
    }
    if (!file.originalname) {
      throw new BadRequestException('File name is required');
    }
    if (!file.mimetype) {
      throw new BadRequestException('File type is required');
    }
    if (!file.size || file.size <= 0) {
      throw new BadRequestException('File size is invalid');
    }
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
      }
      throw error;
    }
  }

  async getById(id: number): Promise<Attachment> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('Invalid attachment ID');
    }
    const attachment =
      await this.attachmentRepository.findOne({ id });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    return attachment;
  }

  async claim(id: number): Promise<Attachment> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('Invalid attachment ID');
    }
    const attachment = await this.getById(id);
    if (attachment.claimedAt) {
      throw new BadRequestException(
        'Attachment has already been claimed',
      );
    }

    const claimedAt = new Date();
    const updated = await this.em.nativeUpdate(
      Attachment,
      {
        id,
        claimedAt: null,
      },
      {
        claimedAt,
      },
    );

    if (updated === 0) {
      throw new BadRequestException(
        'Attachment has already been claimed',
      );
    }
    attachment.claimedAt = claimedAt;
    return attachment;
  }

  async delete(id: number): Promise<void> {
    const attachment = await this.getById(id);
    await this.objectStorage.delete(
      attachment.objectKey,
    );
    try {
      this.em.remove(attachment);
      await this.em.flush();
    } catch (error) {
      throw error;
    }
  }

  async getFile(id: number) {
    const attachment = await this.getById(id);
    const object = await this.objectStorage.get(
      attachment.objectKey,
    );
    return {
      attachment,
      object,
    };
  }
}