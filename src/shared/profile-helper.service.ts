import {BadRequestException, Injectable,NotFoundException,} from '@nestjs/common';
import {  EntityManager,EntityRepository,} from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { randomUUID } from 'crypto';
import { User } from '../database/entities/user.entity';
import { UserSecurityAction } from '../database/entities/user-security-action.entity';
import { UpdateProfileDto } from '../users/profile/dto/update-profiel.dto';

@Injectable()
export class ProfileHelperService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
  ) {}

  async findUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      id: userId,
      deletedAt: null,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  prepareUpdate(
    dto: UpdateProfileDto,
    currentPhone: string,
  ) {
    return {
      fullname: dto.fullname,
      phone: dto.phone,
      updateFullname:   dto.fullname !== undefined,
      changePhone:dto.phone !== undefined && dto.phone !== currentPhone,
    };
  }

  async ensurePhoneAvailable(
    phone: string,
    currentUserId: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      phone,
      deletedAt: null,
    });
    if (user && user.id !== currentUserId) {
      throw new BadRequestException(
        'Phone number is already in use',
      );
    }
  }

  async createPhoneChangeAction(
    user: User,
    phone: string,
  ): Promise<void> {
    await this.ensurePhoneAvailable(
      phone,
      user.id,
    );
    const action = this.em.create(
      UserSecurityAction,
      {
        user,
        usedAt: null,
        expiresAt: this.getExpiration(5),
        secret: randomUUID(),
        eventType: 'PHONE_CHANGE',
        ipAddress: null,
        userAgent: null,
        metadata: JSON.stringify({ phone }),
        createdAt: new Date(),
      },
    );

    this.em.persist(action);
  }

  async findPhoneChangeAction(
    user: User,
    phone: string,
  ): Promise<UserSecurityAction> {
    const actions = await this.em.find(
      UserSecurityAction,
      {
        user,
        eventType: 'PHONE_CHANGE',
        usedAt: null,
      },
      {
        orderBy: {
          createdAt: 'DESC',
        },
      },
    );

    const action = actions.find(
      ({ expiresAt, metadata }) =>
        expiresAt > new Date() &&
        JSON.parse(metadata ?? '{}').phone === phone,
    );

    if (!action) {
      throw new BadRequestException(
        'Invalid or expired phone change request',
      );
    }
    return action;
  }

  private getExpiration(
    minutes: number,
  ): Date {
    const date = new Date();
    date.setMinutes(
      date.getMinutes() + minutes,
    );
    return date;
  }
}