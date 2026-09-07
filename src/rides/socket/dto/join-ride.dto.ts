import { IsNotEmpty, IsString } from 'class-validator';

export class JoinRideDto {
  @IsNotEmpty()
  @IsString()
  rideId!: string;
}
