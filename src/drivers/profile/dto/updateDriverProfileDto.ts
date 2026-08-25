import { IsOptional, IsString } from 'class-validator';

export class UpdateDriverProfileDto {
  @IsOptional()
  @IsString()
  fullname?: string;
}