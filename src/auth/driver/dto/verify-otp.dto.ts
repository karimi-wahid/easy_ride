import {
  IsEnum,
  IsString,
  Matches,
} from 'class-validator';

import { OtpPurpose } from '../../../shared/types/otp-purpose.enum';

export class VerifyOtpDto {
  @IsString()
  phone!: string;

  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'OTP must contain exactly 6 digits',
  })
  code!: string;
}