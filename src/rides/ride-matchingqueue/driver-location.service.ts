import {  BadRequestException,Injectable,} from '@nestjs/common';

@Injectable()
export class DriverLocationService {
  private readonly locations = new Map<
  string,
    {
      lat: number;
      lng: number;
    }
  >();

  setLocation(  driverId: string,lat: number,lng: number,): void {
    if (lat < -90 ||lat > 90 ||lng < -180 ||lng > 180) {
      throw new BadRequestException(
        'Invalid driver location',
      );
    }
    this.locations.set(driverId, { lat,lng,});
  }

  getLocation(  driverId: string, ): {
    lat: number;
    lng: number;
  } | null {
    return (
      this.locations.get(driverId) ?? null
    );
  }

  removeLocation(
    driverId: string,
  ): void {
    this.locations.delete(driverId);
  }
}
