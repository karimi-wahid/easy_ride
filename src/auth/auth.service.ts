import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import {
  generateSecret,
  generateURI,
  verify,
} from 'otplib';

import { User } from '../database/entities/user.entity';
import { UserSession } from '../database/entities/user-session.entity';
import { UserSecurityAction } from '../database/entities/user-security-action.entity';
import { UserTwoFactor } from '../database/entities/user-two-factor.entity';

import { OtpService } from '../shared/otp.service';
import { OtpPurpose } from '../shared/types/otp-purpose.enum';

import { RegisterDto } from './dto/register.dto';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyLoginDto } from './dto/verify-login.dto';
import { VerifyTwoFactorDto } from './dto/verify-2fa.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.em.findOne(User, {
      phone: dto.phone,
      deletedAt: null,
    });

    if (existingUser) {
      throw new ConflictException(
        'Phone number is already registered',
      );
    }

    const action = this.em.create(
      UserSecurityAction,
      {
        user: null,
        usedAt: null,
        expiresAt: this.getExpiration(5),
        secret: randomUUID(),
        eventType: 'REGISTRATION',
        ipAddress: null,
        userAgent: null,
        metadata: JSON.stringify({
          fullname: dto.fullname,
          phone: dto.phone,
        }),
        createdAt: new Date(),
      },
    );

    this.em.persist(action);

    await this.otpService.sendOtp(
      dto.phone,
      OtpPurpose.REGISTRATION,
    );

    await this.em.flush();

    this.logger.log(
      `Registration OTP sent to ${dto.phone}`,
    );
  }

  async verifyRegistration(
    dto: VerifyRegistrationDto,
  ) {
    const actions = await this.em.find(
      UserSecurityAction,
      {
        eventType: 'REGISTRATION',
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
        fullname?: string;
        phone?: string;
      };

      return metadata.phone === dto.phone;
    });

    if (!action) {
      throw new UnauthorizedException(
        'Invalid or expired registration request',
      );
    }

    const metadata = JSON.parse(
      action.metadata ?? '{}',
    ) as {
      fullname?: string;
      phone?: string;
    };

    if (!metadata.fullname || !metadata.phone) {
      throw new UnauthorizedException();
    }

    await this.otpService.verifyOtp(
      dto.phone,
      OtpPurpose.REGISTRATION,
      dto.code,
    );

    const existingUser = await this.em.findOne(
      User,
      {
        phone: dto.phone,
        deletedAt: null,
      },
    );

    if (existingUser) {
      throw new ConflictException(
        'Phone number is already registered',
      );
    }

    const user = this.em.create(User, {
      fullname: metadata.fullname,
      phone: metadata.phone,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    action.user = user;
    action.usedAt = new Date();

    this.em.persist(user);

    await this.em.flush();

    this.logger.log(
      `Registration verified for ${dto.phone}`,
    );
  }

  async login(dto: LoginDto) {
    const user = await this.em.findOne(User, {
      phone: dto.phone,
      deletedAt: null,
    });

    if (!user) {
      throw new UnauthorizedException(
        'Invalid phone number',
      );
    }

    await this.otpService.sendOtp(
      user.phone,
      OtpPurpose.LOGIN,
    );

    this.logger.log(
      `Login OTP sent to ${user.phone}`,
    );
  }

  async verifyLogin(dto: VerifyLoginDto) {
    const user = await this.em.findOne(User, {
      phone: dto.phone,
      deletedAt: null,
    });

    if (!user) {
      throw new UnauthorizedException(
        'Invalid phone number',
      );
    }

    await this.otpService.verifyOtp(
      user.phone,
      OtpPurpose.LOGIN,
      dto.code,
    );

    const twoFactor = await this.em.findOne(
      UserTwoFactor,
      {
        user,
      },
    );

    if (twoFactor?.enabled) {
      const challengeToken = randomUUID();

      const action = this.em.create(
        UserSecurityAction,
        {
          user,
          usedAt: null,
          expiresAt: this.getExpiration(5),
          secret: challengeToken,
          eventType: 'TWO_FACTOR_LOGIN',
          ipAddress: null,
          userAgent: null,
          metadata: null,
          createdAt: new Date(),
        },
      );

      this.em.persist(action);

      await this.em.flush();

      this.logger.log(
        `2FA challenge created for user ${user.id}`,
      );

      return {
        challengeToken,
      };
    }

    return this.createSession(user);
  }

  async enableTwoFactor(userId: string) {
    const user = await this.em.findOne(User, {
      id: userId,
      deletedAt: null,
    });

    if (!user) {
      throw new UnauthorizedException(
        'User not found',
      );
    }

    const existingTwoFactor =
      await this.em.findOne(
        UserTwoFactor,
        {
          user,
        },
      );

    if (existingTwoFactor?.enabled) {
      return {
        secret: existingTwoFactor.secret,
        otpauthUrl: generateURI({
          issuer:
            process.env.APP_NAME ?? 'Easy Ride',
          label: user.phone,
          secret: existingTwoFactor.secret,
        }),
      };
    }

    const secret = generateSecret();

    const otpauthUrl = generateURI({
      issuer:
        process.env.APP_NAME ?? 'Easy Ride',
      label: user.phone,
      secret,
    });

    if (existingTwoFactor) {
      existingTwoFactor.secret = secret;
      existingTwoFactor.enabled = new Date();
      existingTwoFactor.updatedAt = new Date();

      await this.em.flush();

      this.logger.log(
        `2FA enabled for user ${user.id}`,
      );

      return {
        secret,
        otpauthUrl,
      };
    }

    const twoFactor = this.em.create(
      UserTwoFactor,
      {
        user,
        enabled: new Date(),
        secret,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    this.em.persist(twoFactor);

    await this.em.flush();

    this.logger.log(
      `2FA enabled for user ${user.id}`,
    );

    return {
      secret,
      otpauthUrl,
    };
  }

  async verifyTwoFactor(
    dto: VerifyTwoFactorDto,
  ) {
    const action =
      await this.findValidAction(
        dto.challengeToken,
        'TWO_FACTOR_LOGIN',
      );

    if (!action.user) {
      throw new UnauthorizedException(
        'Authentication user not found',
      );
    }

    const user = action.user;

    const twoFactor = await this.em.findOne(
      UserTwoFactor,
      {
        user,
      },
    );

    if (!twoFactor) {
      throw new UnauthorizedException(
        'Two-factor authentication is not configured',
      );
    }

    if (!twoFactor.enabled) {
      throw new UnauthorizedException(
        'Two-factor authentication is not enabled',
      );
    }

    const result = await verify({
      secret: twoFactor.secret,
      token: dto.code,
    });

    if (!result.valid) {
      throw new UnauthorizedException(
        'Invalid two-factor authentication code',
      );
    }

    action.usedAt = new Date();

    await this.em.flush();

    this.logger.log(
      `2FA login verified for user ${user.id}`,
    );

    return this.createSession(user);
  }

  private async createSession(user: User) {
    const accessToken =
      await this.jwtService.signAsync({
        sub: user.id,
        phone: user.phone,
      });

    const refreshToken =
      await this.jwtService.signAsync(
        {
          sub: user.id,
        },
        {
          secret:
            process.env.JWT_REFRESH_SECRET,
          expiresIn: '30d',
        },
      );

    const refreshTokenHash =
      await argon2.hash(refreshToken);

    const expiresAt = new Date();

    expiresAt.setDate(
      expiresAt.getDate() + 30,
    );

    const session = this.em.create(
      UserSession,
      {
        user,
        refreshTokenHash,
        expiresAt,
        revokedAt: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
      },
    );

    this.em.persist(session);

    await this.em.flush();

    return {
      accessToken,
      refreshToken,
    };
  }

  private async findValidAction(
    secret: string,
    eventType: string,
  ) {
    const action =
      await this.em.findOne(
        UserSecurityAction,
        {
          secret,
          eventType,
          usedAt: null,
        },
        {
          populate: ['user'],
        },
      );

    if (!action) {
      throw new UnauthorizedException(
        'Invalid or expired authentication request',
      );
    }

    if (action.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Authentication request has expired',
      );
    }

    return action;
  }

  private getExpiration(minutes: number) {
    const date = new Date();

    date.setMinutes(
      date.getMinutes() + minutes,
    );

    return date;
  }
}