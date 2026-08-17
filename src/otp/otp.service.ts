import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { OtpPurpose } from './types/otp-purpose.enum';

@Injectable()
export class OtpService {
  private readonly mockOtpUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.mockOtpUrl = this.configService.getOrThrow<string>('MOCK_OTP_URL');
  }

  async sendOtp(phone: string, purpose: OtpPurpose) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.mockOtpUrl}/otp/send`, {
          phone,
          purpose,
        }),
      );

      return response.data;
    } catch (error) {
      console.error('OTP SEND ERROR:', error);
      throw new InternalServerErrorException('Unable to send OTP');
    }
  }

  async verifyOtp(phone: string, purpose: OtpPurpose, code: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.mockOtpUrl}/otp/verify`, {
          phone,
          purpose,
          code,
        }),
      );

      return response.data;
    } catch (error) {
      throw new InternalServerErrorException('Unable to verify OTP');
      console.log(error);
    }
  }
}
