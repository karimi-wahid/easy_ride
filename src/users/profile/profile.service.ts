import { BadRequestException, Injectable,NotFoundException,} from '@nestjs/common';
import {EntityManager,EntityRepository,} from '@mikro-orm/postgresql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { randomUUID } from 'crypto';
import { User } from '../../database/entities/user.entity';
import { UserSecurityAction } from '../../database/entities/user-security-action.entity';
import { UpdateProfileDto } from './dto/update-profiel.dto';
import { VerifyPhoneChangeDto } from './dto/verify-phone-change.dto';
import { OtpService } from '../../shared/otp.service';
import { OtpPurpose } from '../../shared/types/otp-purpose.enum';

@Injectable()
export class ProfileService {
  constructor(
    private readonly em: EntityManager,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly otpService: OtpService,
  ) {}

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      id: userId,
      deletedAt: null,
    });
    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }
    return user;
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<{
    user: User;
    phoneVerificationRequired: boolean;
  }> {
    const user = await this.userRepository.findOne({
      id: userId,
      deletedAt: null,
    });

    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }

    let phoneVerificationRequired = false;
    if (dto.fullname !== undefined) {
      user.fullname = dto.fullname;
    }
    if (
      dto.phone !== undefined &&
      dto.phone !== user.phone
    ) {
      const existingUser =
        await this.userRepository.findOne({
          phone: dto.phone,
          deletedAt: null,
        });

      if (
        existingUser &&
        existingUser.id !== user.id
      ) {
        throw new BadRequestException(
          'Phone number is already in use',
        );
      }

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
          metadata: JSON.stringify({
            phone: dto.phone,
          }),
          createdAt: new Date(),
        },
      );

      this.em.persist(action);
      await this.otpService.sendOtp(
        dto.phone,
        OtpPurpose.PHONE_CHANGE,
      );
      phoneVerificationRequired = true;
    }

    await this.em.flush();
    return {
      user,
      phoneVerificationRequired,
    };
  }

  async verifyPhoneChange(
    userId: string,
    dto: VerifyPhoneChangeDto,
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      id: userId,
      deletedAt: null,
    });
    if (!user) {
      throw new NotFoundException(
        'User not found',
      );
    }
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

    const action = actions.find((item) => {
      if (item.expiresAt <= new Date()) {
        return false;
      }
      const metadata = JSON.parse(
        item.metadata ?? '{}',
      ) as {
        phone?: string;
      };
      return metadata.phone === dto.phone;
    });

    if (!action) {
      throw new BadRequestException(
        'Invalid or expired phone change request',
      );
    }
    await this.otpService.verifyOtp(
      dto.phone,
      OtpPurpose.PHONE_CHANGE,
      dto.code,
    );

    const existingUser =
      await this.userRepository.findOne({
        phone: dto.phone,
        deletedAt: null,
      });

    if (
      existingUser &&
      existingUser.id !== user.id
    ) {
      throw new BadRequestException(
        'Phone number is already in use',
      );
    }
    user.phone = dto.phone;
    user.phoneVerifiedAt = new Date();
    action.usedAt = new Date();
    await this.em.flush();
    return user;
  }

  private getExpiration(minutes: number): Date {
    const date = new Date();
    date.setMinutes(
      date.getMinutes() + minutes,
    );
    return date;
  }
}