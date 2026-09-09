import { IsNotEmpty, IsString } from 'class-validator';

export class LeaveRideDto {
  @IsNotEmpty()
  @IsString()
  rideId!: string;
}
