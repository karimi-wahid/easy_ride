import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EntityManager,
  EntityRepository,
} from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';

import { Attachment } from '../../database/entities/attachment.entity';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class AttachmentClaimService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Attachment)
    private readonly attachmentRepository: EntityRepository<Attachment>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
  ) {}

  async claim(
    attachmentUid: string,
    userId: string,
  ): Promise<Attachment> {
    if (!attachmentUid) {
      throw new BadRequestException(
        'Attachment UID is required',
      );
    }

    if (!userId) {
      throw new BadRequestException(
        'User ID is required',
      );
    }

    const attachment =
      await this.attachmentRepository.findOne({
        uid: attachmentUid,
      });

    if (!attachment) {
      throw new NotFoundException(
        'Attachment not found',
      );
    }

    if (attachment.claimedAt) {
      throw new BadRequestException(
        'Attachment has already been claimed',
      );
    }

    const user =
      await this.userRepository.findOne({
        id: userId,
      });

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    if (user.attachmentId) {
      throw new BadRequestException(
        'User already has an attachment',
      );
    }

    const claimedAt = new Date();

    await this.em.transactional(async (em) => {
      attachment.claimedAt = claimedAt;
      user.attachmentId = attachment.uid;

      await em.flush();
    });

    return attachment;
  }
}