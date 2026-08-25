import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class VerifyRegistrationDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}