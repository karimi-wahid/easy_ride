import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';

import {
  Job,
} from 'bullmq';

import {
  RIDE_MATCHING_QUEUE,
  RIDE_MATCHING_JOB,
  RIDE_OFFER_TIMEOUT_JOB,
  RideMatchingJobData,
  RideOfferTimeoutJobData,
  RideMatchingQueue,
} from './ride-matching.queue';

import {
  MatchingService,
} from './matching.service';

import {
  RideOfferService,
} from './ride-offer.service';

import {
  RealtimeService,
} from '../../socket/socket.service';

@Injectable()
@Processor(RIDE_MATCHING_QUEUE)
export class MatchingWorker
  extends WorkerHost
{
  private readonly logger =
    new Logger(MatchingWorker.name);

  /**
   * Driver has this amount of time to
   * accept/reject the offer.
   */
  private readonly OFFER_TIMEOUT_MS =
    10_000;

  /**
   * Maximum PostGIS search radius.
   */
  private readonly SEARCH_RADIUS_METERS =
    3_000;

  /**
   * Retry matching when no driver can
   * currently receive an offer.
   */
  private readonly NO_DRIVER_RETRY_MS =
    3_000;

  constructor(
    private readonly matchingService: MatchingService,

    private readonly rideOfferService: RideOfferService,

    private readonly rideMatchingQueue: RideMatchingQueue,

    private readonly realtimeService: RealtimeService,
  ) {
    super();
  }

  async process(
    job: Job,
  ): Promise<void> {
    switch (job.name) {
      case RIDE_MATCHING_JOB:
        await this.handleMatchingJob(
          job as Job<RideMatchingJobData>,
        );
        return;

      case RIDE_OFFER_TIMEOUT_JOB:
        await this.handleOfferTimeoutJob(
          job as Job<RideOfferTimeoutJobData>,
        );
        return;

      default:
        this.logger.warn(
          `UNKNOWN MATCHING JOB | ` +
          `name=${job.name} | ` +
          `jobId=${job.id}`,
        );
    }
  }

  /**
   * Find the next driver and send exactly
   * one offer.
   *
   * Flow:
   *
   * SEARCHING
   *   ↓
   * find drivers
   *   ↓
   * create ONE offer
   *   ↓
   * send socket event
   *   ↓
   * wait for timeout / rejection
   */
  private async handleMatchingJob(
    job: Job<RideMatchingJobData>,
  ): Promise<void> {
    const {
      rideId,
    } = job.data;

    this.logger.log(
      `MATCHING SEARCH STARTED | ` +
      `rideId=${rideId} | ` +
      `jobId=${job.id}`,
    );

    try {
      const drivers =
        await this.matchingService
          .findNearbyDrivers(
            rideId,
            this.SEARCH_RADIUS_METERS,
          );

      if (drivers.length === 0) {
        this.logger.debug(
          `NO ROUTABLE DRIVER | ` +
          `rideId=${rideId}`,
        );

        await this.scheduleNextMatchingSearch(
          rideId,
          this.NO_DRIVER_RETRY_MS,
        );

        return;
      }

      /**
       * MatchingService already sorted drivers
       * by real OSRM driving ETA.
       *
       * Try them in that order.
       */
      for (const driver of drivers) {
        const offer =
          await this.rideOfferService.createOffer(
            rideId,
            driver,
            this.OFFER_TIMEOUT_MS / 1000,
          );

        /**
         * Driver became unavailable or already
         * received an offer.
         */
        if (!offer) {
          continue;
        }

        /**
         * Send only one offer.
         */
        this.sendDriverOffer(offer);

        this.logger.log(
          `OFFER SENT | ` +
          `rideId=${rideId} | ` +
          `driverId=${offer.driver.id} | ` +
          `offerId=${offer.id} | ` +
          `expiresAt=${offer.expiresAt.toISOString()}`,
        );

        /**
         * createOffer already schedules the
         * expiration job.
         *
         * Do NOT schedule it again here.
         */
        return;
      }

      /**
       * All candidates were unusable.
       *
       * Retry instead of terminating matching.
       */
      this.logger.debug(
        `NO USABLE DRIVER | ` +
        `rideId=${rideId} | ` +
        `retryIn=${this.NO_DRIVER_RETRY_MS}ms`,
      );

      await this.scheduleNextMatchingSearch(
        rideId,
        this.NO_DRIVER_RETRY_MS,
      );
    } catch (error) {
      this.logger.error(
        `MATCHING SEARCH FAILED | ` +
        `rideId=${rideId}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw error;
    }
  }

  /**
   * Process the delayed timeout job.
   *
   * If the offer is still pending and has
   * actually expired:
   *
   *   PENDING -> EXPIRED
   *
   * Then:
   *
   *   start next matching search
   *
   * If the driver accepted/rejected first,
   * no new search is created here.
   */
  private async handleOfferTimeoutJob(
    job: Job<RideOfferTimeoutJobData>,
  ): Promise<void> {
    const {
      rideId,
      offerId,
    } = job.data;

    this.logger.debug(
      `OFFER TIMEOUT CHECK | ` +
      `rideId=${rideId} | ` +
      `offerId=${offerId}`,
    );

    try {
      const expired =
        await this.rideOfferService
          .expireOfferIfPending(
            offerId,
          );

      /**
       * Offer was accepted/rejected/expired
       * already.
       */
      if (!expired) {
        this.logger.debug(
          `OFFER TIMEOUT IGNORED | ` +
          `rideId=${rideId} | ` +
          `offerId=${offerId}`,
        );

        return;
      }

      /**
       * Tell the driver that the offer is
       * no longer available.
       */
      this.realtimeService
        .notifyOfferExpired(
          expired.driverId,
          {
            offerId: expired.offerId,
            rideId: expired.rideId,
          },
        );

      this.logger.log(
        `OFFER EXPIRED | ` +
        `rideId=${expired.rideId} | ` +
        `offerId=${expired.offerId} | ` +
        `driverId=${expired.driverId}`,
      );

      /**
       * Start the next matching attempt.
       *
       * The queue prevents duplicate matching
       * jobs for this ride.
       */
      await this.scheduleNextMatchingSearch(
        expired.rideId,
        0,
      );
    } catch (error) {
      this.logger.error(
        `OFFER TIMEOUT FAILED | ` +
        `rideId=${rideId} | ` +
        `offerId=${offerId}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw error;
    }
  }

  /**
   * Schedule the next matching attempt.
   */
  private async scheduleNextMatchingSearch(
    rideId: string,
    delayMs: number,
  ): Promise<void> {
    await this.rideMatchingQueue
      .addMatchingJob(
        rideId,
        delayMs,
      );

    this.logger.debug(
      `NEXT MATCHING SEARCH SCHEDULED | ` +
      `rideId=${rideId} | ` +
      `delay=${delayMs}ms`,
    );
  }

  /**
   * Send the offer to the driver's
   * permanent socket room.
   */
  private sendDriverOffer(
    offer: NonNullable<
      Awaited<
        ReturnType<
          RideOfferService['createOffer']
        >
      >
    >,
  ): void {
    const ride = offer.ride;

    this.realtimeService.sendDriverOffer(
      offer.driver.id,
      {
        offerId: offer.id,

        rideId: ride.id,

        pickup: {
          latitude: Number(
            ride.pickupLat,
          ),
          longitude: Number(
            ride.pickupLng,
          ),
        },

        destination: {
          latitude: Number(
            ride.destinationLat,
          ),
          longitude: Number(
            ride.destinationLng,
          ),
        },

        estimatedDistance:
          ride.estimatedDistanceKm ??
          undefined,

        estimatedDuration:
          ride.estimatedDurationMinutes ??
          undefined,

        estimatedPrice:
          ride.estimatedFare ??
          undefined,

        expiresAt:
          offer.expiresAt.toISOString(),
      },
    );
  }
}
