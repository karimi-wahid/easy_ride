import { IsString, MinLength } from 'class-validator';

export class DisableTwoFactorDto {
  @IsString()
  @MinLength(8)
  password!: string;
}
