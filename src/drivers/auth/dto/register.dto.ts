import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsPhoneNumber,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  fullname!: string;

  @IsNotEmpty()
  @IsPhoneNumber('AF')
  @Transform(({ value }) => {
    const normalized = value.replace(/\s+/g, '');

    if (normalized.startsWith('0')) {
      return `+93${normalized.substring(1)}`;
    }

    return normalized;
  })
  phone!: string;
}