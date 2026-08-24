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
import { Driver } from '../../database/entities/driver.entity';
import { DriverSession } from '../../database/entities/driver-session.entity';
import { DriverSecurityAction } from '../../database/entities/driver-security-action.entity';
import { DriverTwoFactor } from '../../database/entities/driver-two-factor.entity';
import { OtpService } from '../../shared/otp.service';
import { OtpPurpose } from '../../shared/types/otp-purpose.enum';
import { RegisterDto } from '../../drivers/auth/dto/register.dto';
import { VerifyRegistrationDto } from '../../drivers/auth/dto/verify-registration.dto';
import { LoginDto } from '../../drivers/auth/dto/login.dto';
import { VerifyLoginDto } from '../../drivers/auth/dto/verify-login.dto';
import { VerifyTwoFactorDto } from '../../drivers/auth/dto/verify-2fa.dto';
import { VerifyTwoFactorSetupDto } from '../../drivers/auth/dto/verify-2fa-setup.dto';
import { RefreshTokenDto } from '../../drivers/auth/dto/refresh-token.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpService,
  ) {}

  async register(dto: RegisterDto) {
    const existingDriver = await this.em.findOne(Driver, {
      phone: dto.phone,
      deletedAt: null,
    });

    if (existingDriver) {
      throw new ConflictException(
        'Phone number is already registered',
      );
    }

    const action = this.em.create(DriverSecurityAction, {
      driver: null,
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
    });

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
      DriverSecurityAction,
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
      
      if (item.expiresAt >= new Date()) {
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
      throw new UnauthorizedException(
        'Invalid registration data',
      );
    }

    await this.otpService.verifyOtp(
      dto.phone,
      OtpPurpose.REGISTRATION,
      dto.code,
    );

    const existingDriver = await this.em.findOne(Driver, {
      phone: dto.phone,
      deletedAt: null,
    });

    if (existingDriver) {
      throw new ConflictException(
        'Phone number is already registered',
      );
    }

    const driver = this.em.create(Driver, {
      id: randomUUID(),
      fullname: metadata.fullname,
      phone: metadata.phone,
      phoneVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    action.driver = driver;
    action.usedAt = new Date();

    this.em.persist(driver);

    await this.em.flush();

    this.logger.log(
      `Registration verified for ${dto.phone}`,
    );

    return this.createSession(driver);
  }

  async login(dto: LoginDto) {
    const driver = await this.em.findOne(Driver, {
      phone: dto.phone,
      deletedAt: null,
    });

    if (!driver) {
      throw new UnauthorizedException(
        'Invalid phone number',
      );
    }

    await this.otpService.sendOtp(
      driver.phone,
      OtpPurpose.LOGIN,
    );

    this.logger.log(
      `Login OTP sent to ${driver.phone}`,
    );
  }

  async verifyLogin(dto: VerifyLoginDto) {
    const driver = await this.em.findOne(Driver, {
      phone: dto.phone,
      deletedAt: null,
    });

    if (!driver) {
      throw new UnauthorizedException(
        'Invalid phone number',
      );
    }

    await this.otpService.verifyOtp(
      driver.phone,
      OtpPurpose.LOGIN,
      dto.code,
    );

    const twoFactor = await this.em.findOne(
      DriverTwoFactor,
      {
        driver,
      },
    );

    if (twoFactor?.enabled) {
      const challengeToken = randomUUID();

      const action = this.em.create(
        DriverSecurityAction,
        {
          driver,
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
        `2FA challenge created for user ${driver.id}`,
      );

      return {
        challengeToken,
      };
    }

    return this.createSession(driver);
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: {
      sub: string;
      sid: string;
    };

    try {
      payload =
        await this.jwtService.verifyAsync<{
          sub: string;
          sid: string;
        }>(dto.refreshToken, {
          secret: process.env.JWT_REFRESH_SECRET,
        });
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired refresh token',
      );
    }

    if (!payload.sub || !payload.sid) {
      throw new UnauthorizedException(
        'Invalid refresh token',
      );
    }

    const session = await this.em.findOne(
      DriverSession,
      {
        id: payload.sid,
        revokedAt: null,
      },
      {
        populate: ['driver'],
      },
    );

    if (!session) {
      throw new UnauthorizedException(
        'Session is invalid or revoked',
      );
    }

    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Session has expired',
      );
    }

    const driver = session.driver;

    if (
      !driver ||
      driver.id !== payload.sub ||
      driver.deletedAt
    ) {
      throw new UnauthorizedException(
        'Driver session is invalid',
      );
    }

    const valid = await argon2.verify(
      session.refreshTokenHash,
      dto.refreshToken,
    );

    if (!valid) {
      throw new UnauthorizedException(
        'Invalid refresh token',
      );
    }

    const newRefreshToken =
      await this.jwtService.signAsync(
        {
          sub: driver.id,
          sid: session.id,
        },
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: '30d',
        },
      );

    session.refreshTokenHash =
      await argon2.hash(newRefreshToken);

    await this.em.flush();

    const accessToken =
      await this.jwtService.signAsync({
        sub: driver.id,
        phone: driver.phone,
        sid: session.id,
      });

    this.logger.log(
      `Session refreshed for user ${driver.id}`,
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      sessionId: session.id,
    };
  }

  async logout(
    driverId: string,
    sessionId: string,
  ) {
    const session = await this.em.findOne(
      DriverSession,
      {
        id: sessionId,
        revokedAt: null,
      },
      {
        populate: ['driver'],
      },
    );

    if (!session) {
      throw new UnauthorizedException(
        'Session is invalid or already revoked',
      );
    }

    if (
      !session.driver ||
      session.driver.id !== driverId ||
      session.driver.deletedAt
    ) {
      throw new UnauthorizedException(
        'Driver session is invalid',
      );
    }

    session.revokedAt = new Date();

    await this.em.flush();

    this.logger.log(
      `Session revoked for driver ${driverId}`,
    );

    return {
      success: true,
    };
  }

  async getMe(
    driverId: string,
    sessionId: string,
  ) {
    const session = await this.em.findOne(
      DriverSession,
      {
        id: sessionId,
        revokedAt: null,
      },
      {
        populate: ['driver'],
      },
    );

    if (!session) {
      throw new UnauthorizedException(
        'Session is invalid or revoked',
      );
    }

    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Session has expired',
      );
    }

    const driver = session.driver;

    if (
      !driver ||
      driver.id !== driverId ||
      driver.deletedAt
    ) {
      throw new UnauthorizedException(
        'Driver session is invalid',
      );
    }

    return {
      id: driver.id,
      fullname: driver.fullname,
      phone: driver.phone,
      phoneVerifiedAt:
        driver.phoneVerifiedAt ?? null,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
      },
    };
  }

  async enableTwoFactor(driverId: string) {
    const driver = await this.em.findOne(Driver, {
      id: driverId,
      deletedAt: null,
    });

    if (!driver) {
      throw new UnauthorizedException(
        'driver not found',
      );
    }

    const existingTwoFactor =
      await this.em.findOne(
        DriverTwoFactor,
        { driver },
      );

    if (existingTwoFactor?.enabled) {
      return {
        enabled: true,
        secret: existingTwoFactor.secret,
        otpauthUrl: generateURI({
          issuer:
            process.env.APP_NAME ?? 'Easy Ride',
          label: driver.phone,
          secret: existingTwoFactor.secret,
        }),
      };
    }

    const secret = generateSecret();
    const setupToken = randomUUID();

    const action = this.em.create(
      DriverSecurityAction,
      {
        driver,
        usedAt: null,
        expiresAt: this.getExpiration(10),
        secret: setupToken,
        eventType: 'TWO_FACTOR_SETUP',
        ipAddress: null,
        userAgent: null,
        metadata: JSON.stringify({
          secret,
        }),
        createdAt: new Date(),
      },
    );

    this.em.persist(action);

    await this.em.flush();

    return {
      enabled: false,
      setupToken,
      secret,
      otpauthUrl: generateURI({
        issuer:
          process.env.APP_NAME ?? 'Easy Ride',
        label: driver.phone,
        secret,
      }),
    };
  }

  async verifyTwoFactorSetup(
    driverId: string,
    dto: VerifyTwoFactorSetupDto,
  ) {
    const action = await this.em.findOne(
      DriverSecurityAction,
      {
        secret: dto.setupToken,
        eventType: 'TWO_FACTOR_SETUP',
        usedAt: null,
        driver: driverId,
      },
      {
        populate: ['driver'],
      },
    );

    if (!action) {
      throw new UnauthorizedException(
        'Invalid or expired 2FA setup request',
      );
    }

    if (action.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        '2FA setup request has expired',
      );
    }

    if (
      !action.driver ||
      action.driver.id !== driverId
    ) {
      throw new UnauthorizedException(
        'Invalid 2FA setup request',
      );
    }

    const metadata = JSON.parse(
      action.metadata ?? '{}',
    ) as {
      secret?: string;
    };

    if (!metadata.secret) {
      throw new UnauthorizedException(
        'Invalid 2FA setup data',
      );
    }

    const result = await verify({
      secret: metadata.secret,
      token: dto.code,
    });

    if (!result.valid) {
      throw new UnauthorizedException(
        'Invalid two-factor authentication code',
      );
    }

    let twoFactor = await this.em.findOne(
      DriverTwoFactor,
      {
        driver: action.driver,
      },
    );

    if (twoFactor) {
      twoFactor.secret = metadata.secret;
      twoFactor.enabled = new Date();
      twoFactor.updatedAt = new Date();
    } else {
      twoFactor = this.em.create(
        DriverTwoFactor,
        {
          driver: action.driver,
          secret: metadata.secret,
          enabled: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      );

      this.em.persist(twoFactor);
    }

    action.usedAt = new Date();

    await this.em.flush();

    return {
      enabled: true,
    };
  }

  async verifyTwoFactor(
    dto: VerifyTwoFactorDto,
  ) {
    const action = await this.findValidAction(
      dto.challengeToken,
      'TWO_FACTOR_LOGIN',
    );

    if (!action.driver) {
      throw new UnauthorizedException(
        'Authentication driver not found',
      );
    }

    const driver = action.driver;

    const twoFactor = await this.em.findOne(
      DriverTwoFactor,
      {
        driver,
      },
    );

    if (!twoFactor || !twoFactor.enabled) {
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

    return this.createSession(driver);
  }

  private async createSession(driver: Driver) {
    const sessionId = randomUUID();

    const refreshToken =
      await this.jwtService.signAsync(
        {
          sub: driver.id,
          sid: sessionId,
        },
        {
          secret: process.env.JWT_REFRESH_SECRET,
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
      DriverSession,
      {
        id: sessionId,
        driver,
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

    const accessToken =
      await this.jwtService.signAsync({
        sub: driver.id,
        phone: driver.phone,
        sid: session.id,
      });

    return {
      accessToken,
      refreshToken,
      sessionId,
    };
  }

  private async findValidAction(
    secret: string,
    eventType: string,
  ) {
    const action = await this.em.findOne(
      DriverSecurityAction,
      {
        secret,
        eventType,
        usedAt: null,
      },
      {
        populate: ['driver'],
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