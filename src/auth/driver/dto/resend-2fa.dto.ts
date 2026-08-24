import { IsString, MinLength } from 'class-validator';

export class ResendTwoFactorDto {
  @IsString()
  @MinLength(20)
  challengeToken!: string;
}
