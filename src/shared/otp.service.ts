import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { OtpApiService } from './HttpService.service';
import { OtpPurpose } from './types/otp-purpose.enum';

interface StoredOtp {
  phone: string;
  purpose: OtpPurpose;
  code: string;
  expiresAt: Date;
  verified: boolean;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(
    OtpService.name,
  );

  private readonly otps: StoredOtp[] = [];

  constructor(
    private readonly otpApiService: OtpApiService,
  ) {}

  async sendOtp(
    phone: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const code = this.generateOtp();

    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000,
    );

    this.otps.unshift({
      phone,
      purpose,
      code,
      expiresAt,
      verified: false,
    });

    this.logger.log({
    action: 'OTP_STORED',
    phone,
    purpose,
    code,
    count: this.otps.length,
  });

    await this.otpApiService.sendOtp(
      phone,
      purpose,
      code,
    );

    this.logger.log(
      `OTP request completed for ${purpose}`,
    );
  }

  async verifyOtp(
    phone: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<void> {
    
    const otp = this.otps.find(
      (item) =>
        item.phone === phone &&
        item.purpose === purpose &&
        !item.verified,
    );

    this.logger.log(otp)

    if (!otp) {
      throw new UnauthorizedException(
        'Invalid or expired OTP',
      );
    }

    if (otp.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Invalid or expired OTP',
      );
    }

    if (otp.code !== code) {
      throw new UnauthorizedException(
        'Invalid or expired OTP',
      );
    }

    otp.verified = true;

    this.logger.log(
      `OTP verified for ${purpose}`,
    );
  }

  private generateOtp(): string {
    return Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
  }
}