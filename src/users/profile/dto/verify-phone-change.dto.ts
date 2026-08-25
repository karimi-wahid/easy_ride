import {
  IsNotEmpty,
  IsString,
  Length,
} from 'class-validator';

export class VerifyPhoneChangeDto {
  @IsNotEmpty()
  @IsString()
  phone!: string;

  @IsNotEmpty()
  @IsString()
  @Length(4, 6)
  code!: string;
}