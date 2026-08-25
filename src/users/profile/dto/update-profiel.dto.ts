import { Transform } from 'class-transformer';
import {IsOptional,  IsString,IsPhoneNumber,} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullname?: string;

  @IsOptional()
  @IsPhoneNumber('AF')
  @Transform(({ value }) => {
    const normalized = value.replace(/\s+/g, '');
    if (normalized.startsWith('0')) {
      return `+93${normalized.substring(1)}`;
    }
    return normalized;
  })
  phone?: string;
}