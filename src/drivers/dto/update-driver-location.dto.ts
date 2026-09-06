import {
  IsLatitude,
  IsLongitude,
  IsNumber,
} from 'class-validator';

export class UpdateDriverLocationDto {
  @IsNumber()
  @IsLatitude()
  lat!: number;

  @IsNumber()
  @IsLongitude()
  lng!: number;
}
