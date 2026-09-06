import { IsUUID } from 'class-validator';

export class MatchRideDto {
  @IsUUID()
  rideId!: string;
}
