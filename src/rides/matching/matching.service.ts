import {Injectable,NotFoundException,} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Ride } from '../../database/entities/ride.entity';
import { Driver } from '../../database/entities/driver.entity';
import { DriverStatus } from '../../shared/types/driver-status.enum';
import { RideStatus } from '../../shared/types/ride-status.enum';

@Injectable()
export class MatchingService {
  constructor(
    private readonly em: EntityManager,
  ) {}

  async findNearbyDrivers(
    rideId: string,
    radiusMeters = 3000,
  ): Promise<Driver[]> {
   
    const em = this.em.fork();
    const ride = await em.findOne( Ride,
      {
        id: rideId,
        status: RideStatus.SEARCHING,
        driverId: null,
      },
    );

    if (!ride) {
      throw new NotFoundException(
        'Searching ride not found',
      );
    }

    const drivers =
      await em.getConnection().execute<
        Array<{
          id: string;
        }>
      >(
        `
        SELECT
          d.id

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
      return [];
    }

    const driverIds = drivers.map(
      (driver) => driver.id,
    );

    return em.find(
      Driver,
      {
        id: {
          $in: driverIds,
        },
        deletedAt: null,
      },
    );
  }
}
