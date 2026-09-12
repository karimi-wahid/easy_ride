import { Injectable, Logger,NotFoundException,} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Ride } from '../../database/entities/ride.entity';
import { Driver } from '../../database/entities/driver.entity';
import { DriverStatus } from '../../shared/types/driver-status.enum';
import { RideStatus } from '../../shared/types/ride-status.enum';
import { RoutingService } from '../../routing/routing.service';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(
    MatchingService.name,
  );

  constructor(
    private readonly em: EntityManager,
    private readonly routingService: RoutingService,
  ) {}

  async findNearbyDrivers(
    rideId: string,
    radiusMeters = 3000,
  ): Promise<Driver[]> {
    const em = this.em.fork();

    
    const ride = await em.findOne(Ride, {
      id: rideId,
      status: RideStatus.SEARCHING,
      driverId: null,
    });

    if (!ride) {
      throw new NotFoundException(
        'Searching ride not found',
      );
    }

  
    const drivers =await em.getConnection().execute<  Array<{
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

        WHERE
          d.status = ?
          AND d.deleted_at IS NULL
          AND d.location IS NOT NULL
          AND d.last_location_update >= NOW() - INTERVAL '30 seconds'

          AND ST_DWithin(
            d.location,
            ST_SetSRID(
              ST_MakePoint(?, ?),
              4326
            )::geography,
            ?
          )

        ORDER BY
          ST_Distance(
            d.location,
            ST_SetSRID(
              ST_MakePoint(?, ?),
              4326
            )::geography
          ) ASC

        LIMIT 20
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

    if (drivers.length === 0) {
      this.logger.debug( `NO NEARBY DRIVERS | rideId=${ride.id}`,  );
      return [];
    }

    const driverIds = drivers.map(  (driver) => driver.id,  );
    const driverEntities = await em.find( Driver, {
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
      driverEntities.map((driver) => [
        driver.id,
        driver,
      ]),
    );

    const matchedDrivers = await Promise.all(
        drivers.map(async (candidate) => {
          const driver = driverMap.get(candidate.id);
          if (!driver) {
            return null;
          }

          try {
            const route =    await this.routingService.getDriverToPickupRoute(
                {
                  latitude: Number(candidate.latitude,),
                  longitude: Number( candidate.longitude, ),
                },
                {
                  latitude: Number(  ride.pickupLat,),
                  longitude: Number( ride.pickupLng,),
                },
              );

            return {
              driver,
              distanceMeters: route.distance,
              durationSeconds:   route.duration,
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
        }),
      );

  
    const validMatches = matchedDrivers.filter(
        (  match,): match is {
          driver: Driver;
          distanceMeters: number;
          durationSeconds: number;
        } => match !== null,
      );


    if (validMatches.length === 0) {
      this.logger.warn(
        `NO ROUTABLE DRIVERS | rideId=${ride.id}`,
      );
      return [];
    }

 
    validMatches.sort(
      (a, b) =>
        a.durationSeconds -
        b.durationSeconds,
    );

   
    for ( const match of validMatches ) {
      this.logger.debug(
        `DRIVER MATCH | ` +
          `rideId=${ride.id} | ` +
          `driverId=${match.driver.id} | ` +
          `distance=${Math.round(
            match.distanceMeters,
          )}m | ` +
          `eta=${Math.round(
            match.durationSeconds,
          )}s`,
      );
    }

  
    return validMatches.map(
      (match) => match.driver,
    );
  }
}
