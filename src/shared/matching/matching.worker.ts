import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';

import { Job } from 'bullmq';

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
export class MatchingWorker extends WorkerHost {
  private readonly logger =
    new Logger(MatchingWorker.name);

  private readonly MATCHING_WINDOW_MS =
    30_000;

  private readonly MATCHING_INTERVAL_MS =
    5_000;

  private readonly OFFER_TIMEOUT_MS =
    10_000;

  private readonly SEARCH_RADIUS_METERS =
    3_000;

  constructor(
    private readonly matchingService:
      MatchingService,

    private readonly rideOfferService:
      RideOfferService,

    private readonly rideMatchingQueue:
      RideMatchingQueue,

    private readonly realtimeService:
      RealtimeService,
  ) {
    super();
  }

  async process(
    job: Job,
  ): Promise<void> {
    switch (job.name) {
      case RIDE_MATCHING_JOB:
        await this.handleRideMatching(
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

  
  private async handleRideMatching(
    job: Job<RideMatchingJobData>,
  ): Promise<void> {
    const {
      rideId,
    } = job.data;

    if (!rideId) {
      this.logger.warn(
        `MATCHING JOB HAS NO RIDE ID | ` +
          `jobId=${job.id}`,
      );

      return;
    }

    this.logger.log(
      `RIDE MATCHING CHECK | ` +
        `rideId=${rideId}`,
    );

    try {
  
       
      const timing =
        await this.matchingService
          .getRideMatchingTiming(
            rideId,
          );

      if (!timing) {
        this.logger.debug(
          `RIDE MATCHING TIMING NOT FOUND | ` +
            `rideId=${rideId}`,
        );

        return;
      }

      const {
        searchStartedAt,
        searchExpiresAt,
      } = timing;

      if (
        !searchStartedAt ||
        !searchExpiresAt
      ) {
        this.logger.debug(
          `RIDE HAS NO ACTIVE SEARCH WINDOW | ` +
            `rideId=${rideId}`,
        );

        return;
      }

      const now =
        Date.now();

      const expiresAt =
        new Date(
          searchExpiresAt,
        ).getTime();

      const startedAt =
        new Date(
          searchStartedAt,
        ).getTime();

      const elapsed =
        now - startedAt;

    
      if (
        now >= expiresAt
      ) {
        this.logger.log(
          `MATCHING WINDOW EXPIRED | ` +
            `rideId=${rideId} | ` +
            `elapsed=${elapsed}ms`,
        );

        return;
      }

     
      const state =
        await this.matchingService
          .getMatchingState(
            rideId,
          );

      if (!state.exists) {
        this.logger.debug(
          `RIDE NOT FOUND | ` +
            `rideId=${rideId}`,
        );

        return;
      }

      if (!state.searching) {
        this.logger.debug(
          `MATCHING STOPPED | ` +
            `rideId=${rideId} | ` +
            `status=${state.status}`,
        );

        return;
      }

    
      const drivers =
        await this.matchingService
          .findNearbyDrivers(
            rideId,
            this.SEARCH_RADIUS_METERS,
          );

      if (
        drivers.length === 0
      ) {
        const remainingMs =
          expiresAt - Date.now();

        if (
          remainingMs <= 0
        ) {
          this.logger.log(
            `NO DRIVER FOUND | ` +
              `rideId=${rideId} | ` +
              `matching window finished`,
          );

          return;
        }

        const nextDelay =
          Math.min(
            this.MATCHING_INTERVAL_MS,
            remainingMs,
          );

        await this.scheduleRideMatching(
          rideId,
          nextDelay,
        );

        this.logger.debug(
          `NO DRIVER YET | ` +
            `rideId=${rideId} | ` +
            `nextCheck=${nextDelay}ms`,
        );

        return;
      }

      this.logger.log(
        `NEARBY DRIVERS FOUND | ` +
          `rideId=${rideId} | ` +
          `count=${drivers.length}`,
      );

     
      for (
        const driverMatch of drivers
      ) {
        const currentState =
          await this.matchingService
            .getMatchingState(
              rideId,
            );

        if (
          !currentState.exists ||
          !currentState.searching
        ) {
          this.logger.debug(
            `RIDE STOPPED DURING MATCHING | ` +
              `rideId=${rideId} | ` +
              `status=${currentState.status}`,
          );

          return;
        }

       
        const currentTiming =
          await this.matchingService
            .getRideMatchingTiming(
              rideId,
            );

        if (
          !currentTiming ||
          !currentTiming.searchExpiresAt ||
          new Date(
            currentTiming.searchExpiresAt,
          ).getTime() <= Date.now()
        ) {
          this.logger.log(
            `MATCHING WINDOW EXPIRED DURING DRIVER LOOP | ` +
              `rideId=${rideId}`,
          );

          return;
        }

        try {
          const offer =
            await this.rideOfferService
              .createOffer(
                rideId,
                driverMatch.driver,
                this.OFFER_TIMEOUT_MS /
                  1000,
              );

          if (!offer) {
            this.logger.debug(
              `DRIVER SKIPPED | ` +
                `rideId=${rideId} | ` +
                `driverId=${driverMatch.driver.id}`,
            );

            continue;
          }

          this.sendDriverOffer(
            offer,
            driverMatch.geometry,
            driverMatch.legs,
            driverMatch.steps,
            driverMatch.distanceMeters,
            driverMatch.durationSeconds,
          );

          this.logger.log(
            `OFFER SENT | ` +
              `rideId=${rideId} | ` +
              `driverId=${offer.driver.id} | ` +
              `offerId=${offer.id} | ` +
              `expiresAt=${offer.expiresAt.toISOString()}`,
          );

        
          return;
        } catch (error) {
          this.logger.warn(
            `DRIVER OFFER CREATION SKIPPED | ` +
              `rideId=${rideId} | ` +
              `driverId=${driverMatch.driver.id} | ` +
              `error=${this.getErrorMessage(error)}`,
          );
        }
      }

      const remainingMs =
        expiresAt - Date.now();

      if (
        remainingMs > 0
      ) {
        const nextDelay =
          Math.min(
            this.MATCHING_INTERVAL_MS,
            remainingMs,
          );

        await this.scheduleRideMatching(
          rideId,
          nextDelay,
        );

        this.logger.debug(
          `RETRY SAME RIDE | ` +
            `rideId=${rideId} | ` +
            `remaining=${remainingMs}ms`,
        );
      } else {
        this.logger.log(
          `MATCHING WINDOW FINISHED | ` +
            `rideId=${rideId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `RIDE MATCHING FAILED | ` +
          `rideId=${rideId}`,

        error instanceof Error
          ? error.stack
          : String(error),
      );

     
      try {
        const timing =
          await this.matchingService
            .getRideMatchingTiming(
              rideId,
            );

        if (
          !timing ||
          !timing.searchExpiresAt
        ) {
          return;
        }

        const remainingMs =
          new Date(
            timing.searchExpiresAt,
          ).getTime() -
          Date.now();

        if (
          remainingMs <= 0
        ) {
          return;
        }

        const nextDelay =
          Math.min(
            this.MATCHING_INTERVAL_MS,
            remainingMs,
          );

        await this.scheduleRideMatching(
          rideId,
          nextDelay,
        );
      } catch (scheduleError) {
        this.logger.error(
          `FAILED TO RESCHEDULE MATCHING | ` +
            `rideId=${rideId}`,

          scheduleError instanceof Error
            ? scheduleError.stack
            : String(scheduleError),
        );
      }
    }
  }

 
  private async scheduleRideMatching(
    rideId: string,
    delayMs: number,
  ): Promise<void> {
    await this.rideMatchingQueue
      .addMatchingJob(
        rideId,
        delayMs,
      );

    this.logger.debug(
      `NEXT RIDE MATCHING CHECK SCHEDULED | ` +
        `rideId=${rideId} | ` +
        `delay=${delayMs}ms`,
    );
  }

  
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

      if (!expired) {
        this.logger.debug(
          `OFFER TIMEOUT IGNORED | ` +
            `rideId=${rideId} | ` +
            `offerId=${offerId}`,
        );

        return;
      }

      this.realtimeService
        .notifyOfferExpired(
          expired.driverId,
          {
            offerId:
              expired.offerId,

            rideId:
              expired.rideId,
          },
        );

      this.logger.log(
        `OFFER EXPIRED | ` +
          `rideId=${expired.rideId} | ` +
          `offerId=${expired.offerId} | ` +
          `driverId=${expired.driverId}`,
      );

      
      const state =
        await this.matchingService
          .getMatchingState(
            expired.rideId,
          );

      if (
        !state.exists ||
        !state.searching
      ) {
        this.logger.debug(
          `MATCHING NOT CONTINUED | ` +
            `rideId=${expired.rideId} | ` +
            `status=${state.status}`,
        );

        return;
      }

      const timing =
        await this.matchingService
          .getRideMatchingTiming(
            expired.rideId,
          );

      if (
        !timing ||
        !timing.searchExpiresAt
      ) {
        this.logger.debug(
          `NO ACTIVE SEARCH WINDOW | ` +
            `rideId=${expired.rideId}`,
        );

        return;
      }

      const remainingMs =
        new Date(
          timing.searchExpiresAt,
        ).getTime() -
        Date.now();

      if (
        remainingMs <= 0
      ) {
        this.logger.log(
          `MATCHING WINDOW FINISHED AFTER OFFER EXPIRY | ` +
            `rideId=${expired.rideId}`,
        );

        return;
      }

  
      await this.scheduleRideMatching(
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
    }
  }

  private sendDriverOffer(
    offer: NonNullable<
      Awaited<
        ReturnType<
          RideOfferService['createOffer']
        >
      >
    >,

    geometry?: {
      type: 'LineString';
      coordinates: number[][];
    },

    legs?: any[],

    steps?: any[],

    distanceMeters?: number,

    durationSeconds?: number,
  ): void {
    const ride =
      offer.ride;

    this.realtimeService
      .sendDriverOffer(
        offer.driver.id,
        {
          offerId:
            offer.id,

          rideId:
            ride.id,

          pickup: {
            latitude:
              Number(
                ride.pickupLat,
              ),

            longitude:
              Number(
                ride.pickupLng,
              ),
          },

          destination: {
            latitude:
              Number(
                ride.destinationLat,
              ),

            longitude:
              Number(
                ride.destinationLng,
              ),
          },

          geometry,

          route: {
            distanceMeters,
            durationSeconds,
            geometry,
            legs,
            steps,
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
        } as any,
      );
  }

  private getErrorMessage(
    error: unknown,
  ): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
