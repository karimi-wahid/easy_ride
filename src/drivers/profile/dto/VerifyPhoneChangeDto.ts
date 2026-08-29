import { IsPhoneNumber, IsString } from 'class-validator';

export class VerifyPhoneChangeDto {
  @IsPhoneNumber()
  phone!: string;

  @IsString()
  code!: string;
}