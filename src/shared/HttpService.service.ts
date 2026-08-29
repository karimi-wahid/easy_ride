import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OtpPurpose } from './types/otp-purpose.enum';

@Injectable()
export class OtpApiService {
  private readonly logger = new Logger(
    OtpApiService.name,
  );

  private readonly otpServerUrl =
    'http://localhost:4000/api/otp';

  constructor(
    private readonly httpService: HttpService,
  ) {}

  async sendOtp(
    phone: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.otpServerUrl}/send`,
          {
              phone,
              purpose,
              code
            },
        ),
      );

      this.logger.log("response", response)

      if (!response.data?.success) {
        throw new ServiceUnavailableException(
          'Unable to send OTP',
        );
      }

      this.logger.log(
        `OTP sent for ${purpose} to ${phone}`,
      );
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }

      this.logger.error(
        `Failed to send OTP for ${purpose} to ${phone}`,
        error instanceof Error
          ? error.stack
          : undefined,
      );

      throw new ServiceUnavailableException(
        'Unable to send OTP',
      );
    }
  }
}