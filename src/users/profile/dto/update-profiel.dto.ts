import { Transform } from 'class-transformer';
import {IsOptional,  IsString,IsPhoneNumber,} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullname?: string;

  @IsOptional()
  @IsString()
  @IsPhoneNumber('AF')
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }
    const normalized = value.replace(/\s+/g, '');
    if (normalized.startsWith('0')) {
      return `+93${normalized.substring(1)}`;
    }
    return normalized;
  })
  phone?: string;
}