import { IsLatitude,IsLongitude,IsNotEmpty,IsNumber,IsOptional,IsPositive,IsString,} from 'class-validator';

export class DriverLocationDto {
  @IsNotEmpty()
  @IsString()
  rideId!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @IsNotEmpty()
  @IsNumber()
  timestamp!: number;
}
