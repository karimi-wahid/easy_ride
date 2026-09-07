import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptRideDto {
  @IsNotEmpty()
  @IsString()
  offerId!: string;

  @IsNotEmpty()
  @IsString()
  rideId!: string;
}
