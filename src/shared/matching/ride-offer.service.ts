import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  EntityManager,
} from '@mikro-orm/postgresql';

import { Ride } from '../../database/entities/ride.entity';
import { Driver } from '../../database/entities/driver.entity';
import { RideOffer } from '../../database/entities/ride-driver-offer.entity';
import { LockMode } from '@mikro-orm/core';

import {
  DriverStatus,
} from '../../shared/types/driver-status.enum';

import {
  OfferStatus,
} from '../../shared/types/offer-status.enum';

import {
  RideStatus,
} from '../../shared/types/ride-status.enum';

import {
  RideMatchingQueue,
} from './ride-matching.queue';

@Injectable()
export class RideOfferService {
  private readonly logger =
    new Logger(
      RideOfferService.name,
    );

  constructor(
    private readonly em: EntityManager,

    private readonly rideMatchingQueue:
      RideMatchingQueue,
  ) {}

  async createOffer(
    rideId: string,
    driver: Driver,
    expirationSeconds = 10,
  ): Promise<RideOffer | null> {
    const em =
      this.em.fork();

    try {
      const ride =
        await em.findOne(
          Ride,
          {
            id: rideId,

            status:
              RideStatus.SEARCHING,

            driverId: null,
          },
        );

      if (!ride) {
        this.logger.debug(
          `RIDE NO LONGER SEARCHING | ` +
            `rideId=${rideId}`,
        );

        return null;
      }

    
      if (
        ride.searchExpiresAt &&
        ride.searchExpiresAt.getTime() <=
          Date.now()
      ) {
        this.logger.debug(
          `RIDE SEARCH WINDOW EXPIRED | ` +
            `rideId=${rideId}`,
        );

        return null;
      }

      const currentDriver =
        await em.findOne(
          Driver,
          {
            id: driver.id,

            status:
              DriverStatus.AVAILABLE,

            deletedAt: null,
          },
        );

      if (!currentDriver) {
        this.logger.debug(
          `DRIVER NO LONGER AVAILABLE | ` +
            `driverId=${driver.id} | ` +
            `rideId=${rideId}`,
        );

        return null;
      }

      const now =
        new Date();

      const expiresAt =
        new Date(
          now.getTime() +
            expirationSeconds *
              1000,
        );

   
      const finalExpiresAt =
        ride.searchExpiresAt &&
        ride.searchExpiresAt <
          expiresAt
          ? ride.searchExpiresAt
          : expiresAt;

      
      if (
        finalExpiresAt.getTime() <=
        now.getTime()
      ) {
        this.logger.debug(
          `RIDE SEARCH WINDOW ALREADY EXPIRED | ` +
            `rideId=${rideId}`,
        );

        return null;
      }

      const existingOffer =
        await em.findOne(
          RideOffer,
          {
            ride: ride.id,
            driver:
              currentDriver.id,
          },
        );

      if (existingOffer) {
        if (
          existingOffer.status ===
          OfferStatus.PENDING
        ) {
          if (
            existingOffer.expiresAt
              .getTime() <=
            now.getTime()
          ) {
            const affected =
              await em.nativeUpdate(
                RideOffer,
                {
                  id:
                    existingOffer.id,

                  status:
                    OfferStatus.PENDING,

                  expiresAt: {
                    $lte: now,
                  },
                },
                {
                  status:
                    OfferStatus.EXPIRED,
                },
              );

            if (affected > 0) {
              existingOffer.status =
                OfferStatus.EXPIRED;

              this.logger.debug(
                `STALE PENDING OFFER EXPIRED | ` +
                  `rideId=${rideId} | ` +
                  `driverId=${currentDriver.id} | ` +
                  `offerId=${existingOffer.id}`,
              );
            } else {
              return null;
            }
          } else {
            this.logger.debug(
              `DRIVER HAS PENDING OFFER | ` +
                `driverId=${currentDriver.id} | ` +
                `rideId=${rideId} | ` +
                `offerId=${existingOffer.id}`,
            );

            return null;
          }
        }

        if (
          existingOffer.status ===
          OfferStatus.ACCEPTED
        ) {
          this.logger.debug(
            `DRIVER ALREADY ACCEPTED RIDE | ` +
              `driverId=${currentDriver.id} | ` +
              `rideId=${rideId} | ` +
              `offerId=${existingOffer.id}`,
          );

          return null;
        }

        if (
          existingOffer.status ===
            OfferStatus.EXPIRED ||
          existingOffer.status ===
            OfferStatus.REJECTED
        ) {
          const previousStatus =
            existingOffer.status;

          existingOffer.status =
            OfferStatus.PENDING;

          existingOffer.expiresAt =
            finalExpiresAt;

          await em.flush();

          await this.scheduleExpiration(
            rideId,
            existingOffer.id,
            Math.max(
              0,
              finalExpiresAt.getTime() -
                Date.now(),
            ),
          );

          this.logger.log(
            `OFFER RETRIED | ` +
              `rideId=${rideId} | ` +
              `driverId=${currentDriver.id} | ` +
              `offerId=${existingOffer.id} | ` +
              `previousStatus=${previousStatus} | ` +
              `expiresAt=${finalExpiresAt.toISOString()}`,
          );

          return existingOffer;
        }

        this.logger.warn(
          `OFFER HAS UNSUPPORTED STATUS | ` +
            `rideId=${rideId} | ` +
            `driverId=${currentDriver.id} | ` +
            `offerId=${existingOffer.id} | ` +
            `status=${existingOffer.status}`,
        );

        return null;
      }

      const offer =
        em.create(
          RideOffer,
          {
            ride,

            driver:
              currentDriver,

            status:
              OfferStatus.PENDING,

            expiresAt:
              finalExpiresAt,

            createdAt:
              now,
          },
        );

      em.persist(offer);

      await em.flush();

      await this.scheduleExpiration(
        rideId,
        offer.id,
        Math.max(
          0,
          finalExpiresAt.getTime() -
            Date.now(),
        ),
      );

      this.logger.log(
        `OFFER CREATED | ` +
          `rideId=${rideId} | ` +
          `driverId=${currentDriver.id} | ` +
          `offerId=${offer.id} | ` +
          `expiresAt=${finalExpiresAt.toISOString()}`,
      );

      return offer;
    } catch (error) {
      this.logger.error(
        `CREATE OFFER FAILED | ` +
          `rideId=${rideId} | ` +
          `driverId=${driver.id}`,

        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw error;
    }
  }

  async findPendingOffer(
    rideId: string,
    driverId: string,
  ): Promise<RideOffer | null> {
    const em =
      this.em.fork();

    const offer =
      await em.findOne(
        RideOffer,
        {
          ride: rideId,

          driver: driverId,

          status:
            OfferStatus.PENDING,
        },
      );

    if (!offer) {
      return null;
    }

    if (
      offer.expiresAt.getTime() <=
      Date.now()
    ) {
      const affected =
        await em.nativeUpdate(
          RideOffer,
          {
            id: offer.id,

            status:
              OfferStatus.PENDING,

            expiresAt: {
              $lte: new Date(),
            },
          },
          {
            status:
              OfferStatus.EXPIRED,
          },
        );

      if (affected > 0) {
        this.logger.debug(
          `OFFER EXPIRED WHILE FETCHING | ` +
            `offerId=${offer.id} | ` +
            `rideId=${rideId}`,
        );
      }

      return null;
    }

    return offer;
  }

  async expireOfferIfPending(
    offerId: string,
  ): Promise<{
    offerId: string;
    rideId: string;
    driverId: string;
  } | null> {
    const em =
      this.em.fork();

    const now =
      new Date();

    const offer =
      await em.findOne(
        RideOffer,
        {
          id: offerId,
        },
        {
          populate: [
            'driver',
            'ride',
          ],
        },
      );

    if (!offer) {
      this.logger.debug(
        `OFFER NOT FOUND DURING TIMEOUT | ` +
          `offerId=${offerId}`,
      );

      return null;
    }

    const affected =
      await em.nativeUpdate(
        RideOffer,
        {
          id: offerId,

          status:
            OfferStatus.PENDING,

          expiresAt: {
            $lte: now,
          },
        },
        {
          status:
            OfferStatus.EXPIRED,
        },
      );

    if (affected === 0) {
      this.logger.debug(
        `OFFER ALREADY RESOLVED | ` +
          `offerId=${offerId}`,
      );

      return null;
    }

    this.logger.log(
      `OFFER EXPIRED | ` +
        `offerId=${offer.id} | ` +
        `rideId=${offer.ride.id} | ` +
        `driverId=${offer.driver.id}`,
    );

    return {
      offerId: offer.id,
      rideId: offer.ride.id,
      driverId: offer.driver.id,
    };
  }

  async scheduleExpiration(
    rideId: string,
    offerId: string,
    delayMs = 10_000,
  ): Promise<void> {
    await this.rideMatchingQueue
      .scheduleOfferTimeout(
        rideId,
        offerId,
        delayMs,
      );

    this.logger.debug(
      `OFFER EXPIRATION SCHEDULED | ` +
        `rideId=${rideId} | ` +
        `offerId=${offerId} | ` +
        `delay=${delayMs}ms`,
    );
  }

  async handleOfferTimeout(
    rideId: string,
    offerId: string,
  ): Promise<boolean> {
    this.logger.debug(
      `PROCESSING OFFER TIMEOUT | ` +
        `rideId=${rideId} | ` +
        `offerId=${offerId}`,
    );

    const expired =
      await this.expireOfferIfPending(
        offerId,
      );

    return expired !== null;
  }


async acceptOffer( rideId: string, offerId: string, driverId: string,): Promise<boolean> {
  const em = this.em.fork();
  const now = new Date();
  return em.transactional(async (tx) => {
    const ride = await tx.findOne(
      Ride,
      { id: rideId },
      { lockMode: LockMode.PESSIMISTIC_WRITE },
    );

    if (!ride) {
      this.logger.debug(`RIDE NOT AVAILABLE FOR OFFER | rideId=${rideId}`);
      return false;
    }

    if (   ride.status !== RideStatus.SEARCHING ||   ride.driverId !== null ) {
      this.logger.debug(`RIDE NOT AVAILABLE FOR OFFER | rideId=${rideId}`);
      return false;
    }

    if ( ride.searchExpiresAt && ride.searchExpiresAt.getTime() <= now.getTime() ) {
      this.logger.debug(   `RIDE SEARCH WINDOW EXPIRED | rideId=${rideId} | offerId=${offerId}`, );
      return false;
    }

    const affected = await tx.nativeUpdate(
      RideOffer,
      {
        id: offerId,
        ride: rideId,
        driver: driverId,
        status: OfferStatus.PENDING,
        expiresAt: { $gt: now },
      },
      { status: OfferStatus.ACCEPTED },
    );

    if (affected === 0) {
      this.logger.debug(  `OFFER COULD NOT BE ACCEPTED | rideId=${rideId} | offerId=${offerId} | driverId=${driverId}`,  );
      return false;
    }

    ride.status = RideStatus.ACCEPTED;
    ride.driverId = driverId;
    ride.searchStartedAt = now;

    await tx.flush();
    this.logger.log(   `OFFER ACCEPTED | rideId=${rideId} | offerId=${offerId} | driverId=${driverId}`, );
    return true;
  });
}


  async rejectOffer(
    rideId: string,
    offerId: string,
    driverId: string,
  ): Promise<RideOffer | null> {
    const em =
      this.em.fork();

    const affected =
      await em.nativeUpdate(
        RideOffer,
        {
          id: offerId,

          ride: rideId,

          driver: driverId,

          status:
            OfferStatus.PENDING,

          expiresAt: {
            $gt: new Date(),
          },
        },
        {
          status:
            OfferStatus.REJECTED,
        },
      );

    if (affected === 0) {
      this.logger.debug(
        `OFFER COULD NOT BE REJECTED | ` +
          `rideId=${rideId} | ` +
          `offerId=${offerId} | ` +
          `driverId=${driverId}`,
      );

      return null;
    }

    const offer =
      await em.findOne(
        RideOffer,
        {
          id: offerId,

          ride: rideId,

          driver: driverId,
        },
      );

    if (!offer) {
      this.logger.warn(
        `REJECTED OFFER COULD NOT BE RELOADED | ` +
          `rideId=${rideId} | ` +
          `offerId=${offerId} | ` +
          `driverId=${driverId}`,
      );

      return null;
    }
 
    this.logger.log(
      `OFFER REJECTED | ` +
        `rideId=${rideId} | ` +
        `offerId=${offerId} | ` +
        `driverId=${driverId}`,
    );

    return offer;
  }
}
