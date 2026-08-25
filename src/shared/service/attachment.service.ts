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

@Injectable()
export class AttachmentClaimService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(Attachment)
    private readonly attachmentRepository: EntityRepository<Attachment>,
  ) {}

  async claim(attachmentUid: string): Promise<Attachment> {
    const attachment = await this.attachmentRepository.findOne({
      uid: attachmentUid,
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (attachment.claimedAt) {
      throw new BadRequestException(
        'Attachment has already been claimed',
      );
    }

    const claimedAt = new Date();

    await this.em.transactional(async (em) => {
      attachment.claimedAt = claimedAt;

      await em.flush();
    });

    return attachment;
  }
}