import { IsString, Length, Matches } from 'class-validator';

export class VerifyRegistrationDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'Invalid phone number',
  })
  phone!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, {
    message: 'OTP must contain exactly 6 digits',
  })
  code!: string;
}
