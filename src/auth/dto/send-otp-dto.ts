import {
  IsEnum,
  IsString,
} from 'class-validator';

import { OtpPurpose } from '../../shared/types/otp-purpose.enum';

export class SendOtpDto {
  @IsString()
  phone!: string;

  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;
}