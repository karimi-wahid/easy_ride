import { Injectable } from '@nestjs/common';

import {
  OsrmClient,
  OsrmCoordinate,
  OsrmRoute,
} from './osrm.client';

export interface RideRoute {
 
  distance: number;
  duration: number;
  distanceMeters: number;
  durationSeconds: number;
  geometry?: OsrmRoute['geometry'];
  legs?: OsrmRoute['legs'];
}

@Injectable()
export class RoutingService {
  constructor(
    private readonly osrmClient: OsrmClient,
  ) {}

  /**
   * Driver → Pickup
   *
   * Used by matching.
   *
   * OSRM calculates the REAL driving route,
   * not straight-line distance.
   */
  async getDriverToPickupRoute(
    driver: OsrmCoordinate,
    pickup: OsrmCoordinate,
  ): Promise<RideRoute> {
    const route =
      await this.osrmClient.getRoute(
        driver,
        pickup,
        {
          overview: 'full',
          geometries: 'geojson',
          steps: true,
          alternatives: false,
        },
      );

    return this.formatRoute(route);
  }

  /**
   * Pickup → Destination
   *
   * Used for the passenger's actual ride route.
   */
  async getRideRoute(
    pickup: OsrmCoordinate,
    destination: OsrmCoordinate,
  ): Promise<RideRoute> {
    const route =
      await this.osrmClient.getRoute(
        pickup,
        destination,
        {
          overview: 'full',
          geometries: 'geojson',
          steps: true,
          alternatives: false,
        },
      );

    return this.formatRoute(route);
  }

  async getCompleteRideRoute(
    driver: OsrmCoordinate,
    pickup: OsrmCoordinate,
    destination: OsrmCoordinate,
  ): Promise<RideRoute> {
    const route =
      await this.osrmClient.getRouteThroughPoints(
        [
          driver,
          pickup,
          destination,
        ],
        {
          overview: 'full',
          geometries: 'geojson',
          steps: true,
          alternatives: false,
        },
      );

    return this.formatRoute(route);
  }

  /**
   * Multi-stop route.
   *
   * Example:
   *
   * A → B → C → D
   */
  async getMultiStopRoute(
    points: OsrmCoordinate[],
  ): Promise<RideRoute> {
    if (points.length < 2) {
      throw new Error(
        'At least two coordinates are required to calculate a route',
      );
    }

    const route =
      await this.osrmClient.getRouteThroughPoints(
        points,
        {
          overview: 'full',
          geometries: 'geojson',
          steps: true,
          alternatives: false,
        },
      );

    return this.formatRoute(route);
  }

  /**
   * Convert the OSRM response into the application's
   * route format.
   *
   * We keep both:
   *
   * distance / duration
   *
   * and:
   *
   * distanceMeters / durationSeconds
   *
   * so existing services continue working while
   * matching can use the explicit names.
   */
  private formatRoute(
    route: OsrmRoute,
  ): RideRoute {
    return {
      distance: route.distance,

      duration: route.duration,

      distanceMeters:
        route.distance,

      durationSeconds:
        route.duration,

      geometry:
        route.geometry,

      legs:
        route.legs,
    };
  }
}
