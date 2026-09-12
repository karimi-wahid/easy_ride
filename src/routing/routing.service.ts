import { Injectable } from '@nestjs/common';
import { OsrmClient, OsrmCoordinate,
} from './osrm.client';

@Injectable()
export class RoutingService {
  constructor(
    private readonly osrmClient: OsrmClient,
  ) {}


  async getDriverToPickupRoute(
    driver: OsrmCoordinate,
    pickup: OsrmCoordinate,
  ) {
    return this.osrmClient.getRoute(
      driver,
      pickup,
      {
        overview: 'false',
        geometries: 'geojson',
        steps: false,
      },
    );
  }


  async getRideRoute(
    pickup: OsrmCoordinate,
    destination: OsrmCoordinate,
  ) {
    return this.osrmClient.getRoute(
      pickup,
      destination,
      {
        overview: 'full',
        geometries: 'geojson',
        steps: false,
      },
    );
  }
}
