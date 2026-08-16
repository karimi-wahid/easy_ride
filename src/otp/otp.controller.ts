import { Body, Controller, Post } from '@nestjs/common';

import { OtpService } from './otp.service';
import { OtpPurpose } from './types/otp-purpose.enum';

@Controller('otp')
export class OtpController {
  constructor(private readonly otpService: OtpService) {}

  @Post('send')
  async sendOtp(
    @Body()
    body: {
      phone: string;
      purpose: OtpPurpose;
    },
  ) {
    return this.otpService.sendOtp(body.phone, body.purpose);
  }

  @Post('verify')
  async verifyOtp(
    @Body()
    body: {
      phone: string;
      purpose: OtpPurpose;
      code: string;
    },
  ) {
    return this.otpService.verifyOtp(body.phone, body.purpose, body.code);
  }
}
