import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { EntityManager } from '@mikro-orm/postgresql';
import * as argon2 from 'argon2';

import { OtpService } from '../otp/otp.service';
import { OtpPurpose } from '../otp/types/otp-purpose.enum';
import { RegisterDto } from './dto/register.dto';
import { User } from 'src/entities/users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly otpService: OtpService,
  ) {}

  async register(dto: RegisterDto) {
    const phone = dto.phone.trim();

    let user = await this.em.findOne(User, {
      phone,
    });

    if (user?.phoneVerifiedAt) {
      throw new ConflictException(
        'A user with this phone number already exists',
      );
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    if (user) {
      user.fullname = dto.fullname;
      user.passwordHash = passwordHash;
    } else {
      user = this.em.create(User, {
        fullname: dto.fullname,
        phone,
        passwordHash,

        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await this.em.flush();

    await this.otpService.sendOtp(phone, OtpPurpose.REGISTRATION);

    return {
      success: true,
      message: 'Registration started. OTP has been sent to your phone.',
    };
  }

  async verifyRegistration(phone: string, code: string) {
    const normalizedPhone = phone.trim();

    const user = await this.em.findOne(User, {
      phone: normalizedPhone,
    });

    if (!user) {
      throw new BadRequestException('Registration could not be verified');
    }

    if (user.phoneVerifiedAt) {
      throw new ConflictException('Phone number is already verified');
    }

    await this.otpService.verifyOtp(
      normalizedPhone,
      OtpPurpose.REGISTRATION,
      code,
    );

    user.phoneVerifiedAt = new Date();

    await this.em.flush();

    return {
      success: true,
      message: 'Phone number verified successfully',
    };
  }
}
