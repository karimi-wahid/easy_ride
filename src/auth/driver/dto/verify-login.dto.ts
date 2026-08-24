import {
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class VerifyLoginDto {
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}