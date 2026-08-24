import {
  IsNotEmpty,
  IsString,
  Length,
} from 'class-validator';

export class VerifyTwoFactorSetupDto {
  @IsString()
  @IsNotEmpty()
  setupToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}