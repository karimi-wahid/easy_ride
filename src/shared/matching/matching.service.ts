import {Injectable,Logger,} from '@nestjs/common';
import {EntityManager,} from '@mikro-orm/postgresql';
import {Ride,} from '../../database/entities/ride.entity';
import {Driver,} from '../../database/entities/driver.entity';
import { DriverStatus,} from '../../shared/types/driver-status.enum';
import {RideStatus,} from '../../shared/types/ride-status.enum';
import {RoutingService,} from '../../routing/routing.service';

export interface DriverMatch {
  driver: Driver;
  distanceMeters: number;
  durationSeconds: number;
  geometry?: {
    type: 'LineString';
    coordinates: number[][];
  };
}

@Injectable()
export class MatchingService {
  private readonly logger =new Logger(MatchingService.name,);

  constructor(
    private readonly em:EntityManager,
    private readonly routingService:
      RoutingService,
  ) {}


  async findSearchingRides(): Promise<Ride[]> {
    const em = this.em.fork();
    const rides = await em.find(
        Ride,
        {
          status: RideStatus.SEARCHING,
          driverId: null,
        },
        {
          orderBy: {
            createdAt: 'ASC',
          },
        },
      );

    this.logger.debug(
      `SEARCHING RIDES FOUND | ` +
      `count=${rides.length}`,
    );

    return rides;
  }


  async getMatchingState( rideId: string, ): Promise<{
    exists: boolean;
    searching: boolean;
    status: RideStatus | null;
  }> {
    const em = this.em.fork();

    const ride = await em.findOne(
        Ride,
        {
          id: rideId,
        },
        {
          fields: [
            'id',
            'status',
          ],
        },
      );

    if (!ride) {
      return {
        exists: false,
        searching: false,
        status: null,
      };
    }

    return {
      exists: true,
      searching: ride.status === RideStatus.SEARCHING,
      status:ride.status,
    };
  }


  async findNearbyDrivers(
    rideId: string,
    radiusMeters = 3000,
  ): Promise<DriverMatch[]> {
    const em =this.em.fork();

    const ride =await em.findOne(
        Ride,
        {
          id: rideId,
          status: RideStatus.SEARCHING,
          driverId: null,
        },
      );

    if (!ride) {
      this.logger.debug(
        `RIDE NO LONGER SEARCHING | ` +
        `rideId=${rideId}`,
      );
      return [];
    }

    const candidates =await em.getConnection()
        .execute<
          Array<{
            id: string;
            latitude: number;
            longitude: number;
          }>
        >(
          `
          SELECT
            d.id,
            ST_Y(
              d.location::geometry
            ) AS latitude,

            ST_X(
              d.location::geometry
            ) AS longitude

          FROM drivers d
          WHERE d.status = ?
            AND d.deleted_at IS NULL
            AND d.location IS NOT NULL
            AND d.last_location_update >= NOW() - INTERVAL '30 seconds'
            AND ST_DWithin(
              d.location,
              ST_SetSRID(
                ST_MakePoint(
                  ?,
                  ?
                ),
                4326
              )::geography,
              ?
            )
          ORDER BY
            ST_Distance(
              d.location,
              ST_SetSRID(
                ST_MakePoint(
                  ?,
                  ?
                ),
                4326
              )::geography
            ) ASC
          `,
          [
            DriverStatus.AVAILABLE,
            ride.pickupLng,
            ride.pickupLat,
            radiusMeters,
            ride.pickupLng,
            ride.pickupLat,
          ],
        );

    if (candidates.length === 0) {
      this.logger.debug(
        `NO NEARBY DRIVERS | ` +
        `rideId=${ride.id}`,
      );
      return [];
    }

    this.logger.debug(
      `NEARBY DRIVERS FOUND | ` +
      `rideId=${ride.id} | ` +
      `count=${candidates.length}`,
    );

    const driverIds = candidates.map(
      (candidate) =>candidate.id,
    );

    const driverEntities = await em.find(
      Driver,
      {
        id: {
          $in: driverIds,
        },
        deletedAt: null,
      },
    );

    if (driverEntities.length === 0) {
      return [];
    }

    const driverMap = new Map(
      driverEntities.map(
        (driver) => [
          driver.id,
          driver,
        ],
      ),
    );


    const matchedDrivers = await Promise.all(
      candidates.map(
        async (candidate): Promise<DriverMatch | null> => {
          const driver =driverMap.get(
            candidate.id,
          );

          if (!driver) {
            return null;
          }

          try {
            const route =
              await this.routingService.getDriverToPickupRoute(
                {
                  latitude:Number(
                    candidate.latitude,
                  ),
                  longitude:Number(
                    candidate.longitude,
                  ),
                },
                {
                  latitude:Number(
                    ride.pickupLat,
                  ),
                  longitude:Number(
                    ride.pickupLng,
                  ),
                },
              );

            return {
              driver,
              distanceMeters:route.distanceMeters,
              durationSeconds:route.durationSeconds,
              geometry:route.geometry
                ? {
                    type: 'LineString',
                    coordinates:route.geometry.coordinates,
                  }
                : undefined,
            };

          } catch (error) {
            this.logger.warn(
              `OSRM ROUTE FAILED | ` +
              `rideId=${ride.id} | ` +
              `driverId=${candidate.id} | ` +
              `error=${
                error instanceof Error
                  ? error.message
                  : String(error)
              }`,
            );

            return null;
          }
        },
      ),
    );

    const validMatches = matchedDrivers.filter(
      (match): match is DriverMatch =>
        match !== null,
    );

    if (validMatches.length === 0) {
      this.logger.warn(
        `NO ROUTABLE DRIVERS | ` +
        `rideId=${ride.id}`,
      );
      return [];
    }

    validMatches.sort(
      (a, b) =>
        a.durationSeconds -
        b.durationSeconds,
    );

    for (const match of validMatches) {
      this.logger.debug(
        `DRIVER MATCH | ` +
        `rideId=${ride.id} | ` +
        `driverId=${match.driver.id} | ` +
        `distance=${Math.round(match.distanceMeters)}m | ` +
        `eta=${Math.round(match.durationSeconds)}s`,
      );
    }

    return validMatches;
  }
}
