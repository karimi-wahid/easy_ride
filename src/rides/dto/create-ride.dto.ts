import {
  IsLatitude,
  IsLongitude,
} from 'class-validator';

export class CreateRideDto {
  @IsLatitude()
  pickupLat!: number;

  @IsLongitude()
  pickupLng!: number;

  @IsLatitude()
  destinationLat!: number;

  @IsLongitude()
  destinationLng!: number;
}
