import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RejectRideDto {
  @IsNotEmpty()
  @IsString()
  offerId!: string;

  @IsNotEmpty()
  @IsString()
  rideId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
