import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { OtpApiService } from './HttpService.service';
import { OtpPurpose } from './types/otp-purpose.enum';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(
    OtpService.name,
  );

  constructor(
    private readonly otpApiService: OtpApiService,
  ) {}

  async sendOtp(
    phone: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    await this.otpApiService.sendOtp(
      phone,
      purpose,
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
    const verified =
      await this.otpApiService.verifyOtp(
        phone,
        purpose,
        code,
      );

    if (!verified) {
      throw new UnauthorizedException(
        'Invalid or expired OTP',
      );
    }

    this.logger.log(
      `OTP verified for ${purpose}`,
    );
  }
}