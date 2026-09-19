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

import { DriverStatus } from '../../shared/types/driver-status.enum';
import { OfferStatus } from '../../shared/types/offer-status.enum';
import { RideStatus } from '../../shared/types/ride-status.enum';

import { RideMatchingQueue } from './ride-matching.queue';

@Injectable()
export class RideOfferService {
  private readonly logger =
    new Logger(RideOfferService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly rideMatchingQueue: RideMatchingQueue,
  ) {}

  /**
   * Create ONE offer for ONE driver.
   *
   * The following conditions are checked again
   * immediately before creating the offer:
   *
   * - ride must still be SEARCHING
   * - ride must not already have a driver
   * - driver must still be AVAILABLE
   * - driver must not already have an offer for
   *   this ride
   *
   * The expiration timeout is scheduled exactly
   * once here.
   */
  async createOffer(
    rideId: string,
    driver: Driver,
    expirationSeconds = 10,
  ): Promise<RideOffer | null> {
    const em = this.em.fork();

    try {
      const ride = await em.findOne(
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

        return null;
      }

      /**
       * Reload the driver.
       *
       * The entity received from matching may be
       * stale because the driver can change status
       * between the OSRM search and this point.
       */
      const currentDriver =
        await em.findOne(
          Driver,
          {
            id: driver.id,
            status: DriverStatus.AVAILABLE,
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

      /**
       * Do not send another offer to a driver
       * who already received an offer for this ride.
       *
       * This also prevents a rejected/expired driver
       * from receiving the same ride again.
       */
      const existingOffer =
        await em.findOne(
          RideOffer,
          {
            ride,
            driver: currentDriver,
          },
        );

      if (existingOffer) {
        this.logger.debug(
          `DRIVER ALREADY OFFERED RIDE | ` +
          `driverId=${currentDriver.id} | ` +
          `rideId=${rideId} | ` +
          `offerId=${existingOffer.id} | ` +
          `status=${existingOffer.status}`,
        );

        return null;
      }

      const now = new Date();

      const expiresAt = new Date(
        now.getTime() +
        expirationSeconds * 1000,
      );

      const offer = em.create(
        RideOffer,
        {
          ride,
          driver: currentDriver,
          status: OfferStatus.PENDING,
          expiresAt,
          createdAt: now,
        },
      );

      em.persist(offer);

      await em.flush();

      /**
       * Schedule exactly one timeout job.
       *
       * scheduleOfferTimeout() uses offerId as
       * the BullMQ job id, so it is idempotent.
       */
      await this.scheduleExpiration(
        rideId,
        offer.id,
        expirationSeconds * 1000,
      );

      this.logger.log(
        `OFFER CREATED | ` +
        `rideId=${rideId} | ` +
        `driverId=${currentDriver.id} | ` +
        `offerId=${offer.id} | ` +
        `expiresAt=${expiresAt.toISOString()}`,
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

  /**
   * Find a currently pending offer.
   *
   * If the expiration timestamp has already passed,
   * the offer is atomically changed to EXPIRED and
   * null is returned.
   */
  async findPendingOffer(
    rideId: string,
    driverId: string,
  ): Promise<RideOffer | null> {
    const em = this.em.fork();

    const offer = await em.findOne(
      RideOffer,
      {
        ride: rideId,
        driver: driverId,
        status: OfferStatus.PENDING,
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
            status: OfferStatus.PENDING,
            expiresAt: {
              $lte: new Date(),
            },
          },
          {
            status: OfferStatus.EXPIRED,
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

  /**
   * Atomically expire an offer.
   *
   * Only a PENDING offer whose expiration timestamp
   * has passed can be changed.
   *
   * Returns the expired offer information so the
   * worker can notify the correct driver.
   */
  async expireOfferIfPending(
    offerId: string,
  ): Promise<{
    offerId: string;
    rideId: string;
    driverId: string;
  } | null> {
    const em = this.em.fork();

    const now = new Date();

    /**
     * Load the offer first so we know which driver
     * must receive the expiration event.
     */
    const offer = await em.findOne(
      RideOffer,
      {
        id: offerId,
      },
      {
        populate: ['driver', 'ride'],
      },
    );

    if (!offer) {
      this.logger.debug(
        `OFFER NOT FOUND DURING TIMEOUT | ` +
        `offerId=${offerId}`,
      );

      return null;
    }

    /**
     * Atomic state transition.
     *
     * If another request accepted/rejected/expired
     * the offer first, affected will be zero.
     */
    const affected =
      await em.nativeUpdate(
        RideOffer,
        {
          id: offerId,
          status: OfferStatus.PENDING,
          expiresAt: {
            $lte: now,
          },
        },
        {
          status: OfferStatus.EXPIRED,
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

  /**
   * Schedule an offer timeout through BullMQ.
   */
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

  /**
   * Compatibility method.
   */
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

  /**
   * Accept an offer.
   *
   * This method only changes the offer state.
   *
   * Ride assignment is handled by the rides
   * service so that the ride state transition
   * remains in one place.
   */
  async acceptOffer(
    rideId: string,
    offerId: string,
    driverId: string,
  ): Promise<boolean> {
    const em = this.em.fork();

    const now = new Date();

    /**
     * Make sure the ride is still available.
     */
    const ride = await em.findOne(
      Ride,
      {
        id: rideId,
        status: RideStatus.SEARCHING,
        driverId: null,
      },
    );

    if (!ride) {
      this.logger.debug(
        `RIDE NOT AVAILABLE FOR OFFER | ` +
        `rideId=${rideId}`,
      );

      return false;
    }

    /**
     * Atomically transition:
     *
     * PENDING -> ACCEPTED
     *
     * An expired offer cannot be accepted.
     */
    const affected =
      await em.nativeUpdate(
        RideOffer,
        {
          id: offerId,
          ride: rideId,
          driver: driverId,
          status: OfferStatus.PENDING,
          expiresAt: {
            $gt: now,
          },
        },
        {
          status: OfferStatus.ACCEPTED,
        },
      );

    if (affected === 0) {
      this.logger.debug(
        `OFFER COULD NOT BE ACCEPTED | ` +
        `rideId=${rideId} | ` +
        `offerId=${offerId} | ` +
        `driverId=${driverId}`,
      );

      return false;
    }

    await em.flush();

    this.logger.log(
      `OFFER ACCEPTED | ` +
      `rideId=${rideId} | ` +
      `offerId=${offerId} | ` +
      `driverId=${driverId}`,
    );

    return true;
  }

  /**
   * Reject an offer.
   *
   * PENDING -> REJECTED
   *
   * The caller is responsible for starting the
   * next matching search after successful rejection.
   */
  async rejectOffer(
    rideId: string,
    offerId: string,
    driverId: string,
  ): Promise<RideOffer | null> {
    const em = this.em.fork();

    const affected =
      await em.nativeUpdate(
        RideOffer,
        {
          id: offerId,
          ride: rideId,
          driver: driverId,
          status: OfferStatus.PENDING,
          expiresAt: {
            $gt: new Date(),
          },
        },
        {
          status: OfferStatus.REJECTED,
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

    const offer = await em.findOne(
      RideOffer,
      {
        id: offerId,
      },
    );

    if (!offer) {
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

  /**
   * Compatibility method.
   */
  async expireOffer(
    offer: RideOffer,
  ): Promise<void> {
    await this.expireOfferIfPending(
      offer.id,
    );
  }
}
