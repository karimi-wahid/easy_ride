import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';

import { EntityManager } from '@mikro-orm/postgresql';
import * as argon2 from 'argon2';

import { OtpService } from '../otp/otp.service';
import { OtpPurpose } from '../otp/types/otp-purpose.enum';
import { RegisterDto } from './dto/register.dto';
import { User } from 'src/entities/users/user.entity';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { AuthSession } from 'src/entities/auth-session/auth-session.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly em: EntityManager,
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
        twoFactorEnabled: false,
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

  async login(dto: LoginDto) {
    const phone = dto.phone.trim();

    const user = await this.em.findOne(User, {
      phone,
    });

    if (!user) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    if (!user.phoneVerifiedAt) {
      throw new UnauthorizedException('Phone number has not been verified');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid phone number or password');
    }

    if (user.twoFactorEnabled) {
      await this.otpService.sendOtp(user.phone, OtpPurpose.TWO_FACTOR);

      const challengeToken = await this.jwtService.signAsync(
        {
          sub: user.id,
          purpose: '2FA_LOGIN',
        },
        {
          secret: this.configService.getOrThrow<string>('JWT_2FA_SECRET'),
          expiresIn: '5m',
        },
      );

      return {
        success: true,
        requiresTwoFactor: true,
        challengeToken,
        message: 'Two-factor authentication code has been sent to your phone.',
      };
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      phone: user.phone,
    });

    const refreshToken = await this.createRefreshToken(user);

    await this.em.flush();

    return {
      success: true,
      accessToken,
      refreshToken: refreshToken.token,
    };
  }

  private async createRefreshToken(user: User): Promise<{
    token: string;
    session: AuthSession;
  }> {
    const token = await this.jwtService.signAsync(
      {
        sub: user.id,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '30d',
      },
    );

    const refreshTokenHash = await argon2.hash(token);

    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + 30);

    const session = this.em.create(AuthSession, {
      userId: user.id,
      refreshTokenHash,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.em.persist(session);

    return {
      token,
      session,
    };
  }

  async refresh(refreshToken: string) {
    let payload: {
      sub: number;
    };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const sessions = await this.em.find(AuthSession, {
      userId: payload.sub,
      revokedAt: null,
    });

    let currentSession: AuthSession | undefined;

    for (const session of sessions) {
      if (session.expiresAt <= new Date()) {
        continue;
      }

      const matches = await argon2.verify(
        session.refreshTokenHash,
        refreshToken,
      );

      if (matches) {
        currentSession = session;
        break;
      }
    }

    if (!currentSession) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.em.findOne(User, {
      id: payload.sub,
    });

    if (!user || !user.phoneVerifiedAt) {
      throw new UnauthorizedException('User is not authorized');
    }

    // Revoke old session.

    currentSession.revokedAt = new Date();

    // Generate replacement refresh token.

    const newRefreshToken = await this.createRefreshToken(user);

    // Generate new access token.

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      phone: user.phone,
    });

    await this.em.flush();

    return {
      success: true,
      accessToken,
      refreshToken: newRefreshToken.token,
    };
  }

  async logout(refreshToken: string) {
    let payload: {
      sub: number;
    };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      return {
        success: true,
        message: 'Logged out successfully',
      };
    }

    const sessions = await this.em.find(AuthSession, {
      userId: payload.sub,
      revokedAt: null,
    });

    for (const session of sessions) {
      const matches = await argon2.verify(
        session.refreshTokenHash,
        refreshToken,
      );

      if (matches) {
        session.revokedAt = new Date();
        break;
      }
    }

    await this.em.flush();

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  async verifyTwoFactor(challengeToken: string, code: string) {
    let payload: {
      sub: number;
      purpose: string;
    };

    try {
      payload = await this.jwtService.verifyAsync(challengeToken, {
        secret: this.configService.getOrThrow<string>('JWT_2FA_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA challenge');
    }

    if (payload.purpose !== '2FA_LOGIN') {
      throw new UnauthorizedException('Invalid 2FA challenge');
    }

    const user = await this.em.findOne(User, {
      id: payload.sub,
    });

    if (!user || !user.phoneVerifiedAt) {
      throw new UnauthorizedException('User is not authorized');
    }

    if (!user.twoFactorEnabled) {
      throw new UnauthorizedException(
        'Two-factor authentication is not enabled',
      );
    }

    await this.otpService.verifyOtp(user.phone, OtpPurpose.TWO_FACTOR, code);

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      phone: user.phone,
    });

    const refreshToken = await this.createRefreshToken(user);

    await this.em.flush();

    return {
      success: true,
      accessToken,
      refreshToken: refreshToken.token,
    };
  }

  async enableTwoFactor(userId: number) {
    const user = await this.em.findOne(User, {
      id: userId,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.phoneVerifiedAt) {
      throw new BadRequestException('Phone number must be verified first');
    }

    if (user.twoFactorEnabled) {
      return {
        success: true,
        message: 'Two-factor authentication is already enabled',
      };
    }

    await this.otpService.sendOtp(user.phone, OtpPurpose.TWO_FACTOR);

    return {
      success: true,
      message: 'Verification code has been sent to your phone.',
    };
  }

  async verifyEnableTwoFactor(userId: number, code: string) {
    const user = await this.em.findOne(User, {
      id: userId,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.phoneVerifiedAt) {
      throw new BadRequestException('Phone number must be verified first');
    }

    if (user.twoFactorEnabled) {
      throw new ConflictException(
        'Two-factor authentication is already enabled',
      );
    }

    await this.otpService.verifyOtp(user.phone, OtpPurpose.TWO_FACTOR, code);

    user.twoFactorEnabled = true;

    await this.em.flush();

    return {
      success: true,
      message: 'Two-factor authentication enabled successfully',
    };
  }

  async disableTwoFactor(userId: number, password: string) {
    const user = await this.em.findOne(User, {
      id: userId,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.twoFactorEnabled) {
      return {
        success: true,
        message: 'Two-factor authentication is already disabled',
      };
    }

    const passwordValid = await argon2.verify(user.passwordHash, password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    user.twoFactorEnabled = false;

    /*
      Revoke existing sessions.
     
      This is important because changing
      authentication security should invalidate
      existing refresh sessions.
     */
    const sessions = await this.em.find(AuthSession, {
      userId,
      revokedAt: null,
    });

    for (const session of sessions) {
      session.revokedAt = new Date();
    }

    await this.em.flush();

    return {
      success: true,
      message: 'Two-factor authentication disabled successfully',
    };
  }

  async resendTwoFactorOtp(challengeToken: string) {
    let payload: {
      sub: number;
      purpose: string;
    };

    try {
      payload = await this.jwtService.verifyAsync(challengeToken, {
        secret: this.configService.getOrThrow<string>('JWT_2FA_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA challenge');
    }

    if (payload.purpose !== '2FA_LOGIN') {
      throw new UnauthorizedException('Invalid 2FA challenge');
    }

    const user = await this.em.findOne(User, {
      id: payload.sub,
    });

    if (!user || !user.twoFactorEnabled) {
      throw new UnauthorizedException('Invalid 2FA request');
    }

    await this.otpService.sendOtp(user.phone, OtpPurpose.TWO_FACTOR);

    return {
      success: true,
      message: 'A new verification code has been sent to your phone.',
    };
  }

  async forgotPassword(phone: string) {
    const normalizedPhone = phone.trim();

    const user = await this.em.findOne(User, {
      phone: normalizedPhone,
    });

    // Don't reveal whether the account exists.

    if (!user) {
      return {
        success: true,
        message:
          'If an account exists for this phone number, a password reset code has been sent.',
      };
    }

    await this.otpService.sendOtp(normalizedPhone, OtpPurpose.PASSWORD_RESET);

    return {
      success: true,
      message:
        'If an account exists for this phone number, a password reset code has been sent.',
    };
  }

  async resetPassword(phone: string, code: string, newPassword: string) {
    const normalizedPhone = phone.trim();

    // Verify the OTP first.

    await this.otpService.verifyOtp(
      normalizedPhone,
      OtpPurpose.PASSWORD_RESET,
      code,
    );

    const user = await this.em.findOne(User, {
      phone: normalizedPhone,
    });

    if (!user) {
      throw new BadRequestException('Unable to reset password');
    }

    // Hash the new password.

    user.passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
    });

    //  Password changes invalidate existing sessions.

    const sessions = await this.em.find(AuthSession, {
      userId: user.id,
      revokedAt: null,
    });

    for (const session of sessions) {
      session.revokedAt = new Date();
    }

    await this.em.flush();

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }
}
