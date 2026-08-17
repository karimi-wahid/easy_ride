import { IsString, Length, Matches } from 'class-validator';

export class VerifyTwoFactorDto {
  @IsString()
  challengeToken!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, {
    message: 'OTP must contain exactly 6 digits',
  })
  code!: string;
}
