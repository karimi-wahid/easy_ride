import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
} from 'class-validator';

export class LoginDto {
  @IsString()
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