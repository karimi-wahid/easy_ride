import {Injectable,Logger,} from '@nestjs/common';
import {Processor,WorkerHost,} from '@nestjs/bullmq';
import {Job,} from 'bullmq';
import {RIDE_MATCHING_QUEUE,RIDE_MATCHING_JOB,RIDE_OFFER_TIMEOUT_JOB,RideMatchingJobData,RideOfferTimeoutJobData,RideMatchingQueue,} from './ride-matching.queue';
import {MatchingService,} from './matching.service';
import {RideOfferService,} from './ride-offer.service';
import {RealtimeService,} from '../../socket/socket.service';


@Injectable()
@Processor(RIDE_MATCHING_QUEUE)
export class MatchingWorker extends WorkerHost {
  
  private readonly logger =new Logger(MatchingWorker.name);
  private readonly OFFER_TIMEOUT_MS =10_000;
  private readonly SEARCH_RADIUS_METERS =3_000;
  private readonly MATCHING_RETRY_MS = 5_000;

  constructor(
    private readonly matchingService: MatchingService,
    private readonly rideOfferService: RideOfferService,
    private readonly rideMatchingQueue:RideMatchingQueue,
    private readonly realtimeService: RealtimeService,) {
    super();
  }

  async process( job: Job,): Promise<void> {
    switch (job.name) {
      case RIDE_MATCHING_JOB:
        await this.handleMatchingScan(
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


  private async handleMatchingScan(
    job: Job<RideMatchingJobData>,
  ): Promise<void> {
    this.logger.log(
      `MATCHING DATABASE SCAN STARTED | ` +
      `jobId=${job.id}`,
    );

    try {
      const rides =
        await this.matchingService.findSearchingRides();

      if (rides.length === 0) {
        this.logger.debug(
          `NO SEARCHING RIDES`,
        );

        await this.scheduleNextMatchingScan(
          this.MATCHING_RETRY_MS,
          'NO_SEARCHING_RIDES',
        );

        return;
      }

      this.logger.log(
        `SEARCHING RIDES FOUND | ` +
        `count=${rides.length}`,
      );

      for (const ride of rides) {
        try {
          await this.processRide(
            ride.id,
          );
        } catch (error) {
          this.logger.error(
            `RIDE MATCHING FAILED | ` +
            `rideId=${ride.id}`,
            error instanceof Error
              ? error.stack
              : String(error),
          );
        }
      }

      await this.scheduleNextMatchingScan(
        this.MATCHING_RETRY_MS,
        'SCAN_COMPLETE',
      );

    } catch (error) {
      this.logger.error(
        `MATCHING DATABASE SCAN FAILED`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      await this.scheduleNextMatchingScan(
        this.MATCHING_RETRY_MS,
        'SCAN_ERROR',
      );
    }
  }

private async processRide(
  rideId: string,
): Promise<void> {
  this.logger.log(
    `PROCESSING SEARCHING RIDE | ` +
    `rideId=${rideId}`,
  );

  const state =
    await this.matchingService.getMatchingState(
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
      `RIDE NO LONGER SEARCHING | ` +
      `rideId=${rideId} | ` +
      `status=${state.status}`,
    );

    return;
  }

  const drivers =
    await this.matchingService.findNearbyDrivers(
      rideId,
      this.SEARCH_RADIUS_METERS,
    );

  if (drivers.length === 0) {
    this.logger.debug(
      `NO DRIVER FOR RIDE | ` +
      `rideId=${rideId}`,
    );

    return;
  }
    
  for (const driverMatch of drivers) {
    const currentState =
      await this.matchingService.getMatchingState(
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

    try {
      const offer =
        await this.rideOfferService.createOffer(
          rideId,
          driverMatch.driver,
          this.OFFER_TIMEOUT_MS / 1000,
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

  this.logger.debug(
    `ALL DRIVERS UNUSABLE | ` +
    `rideId=${rideId}`,
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
        await this.rideOfferService.expireOfferIfPending(
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

      this.realtimeService.notifyOfferExpired(
        expired.driverId,
        {
          offerId:expired.offerId,
          rideId:expired.rideId,
        },
      );

      this.logger.log(
        `OFFER EXPIRED | ` +
        `rideId=${expired.rideId} | ` +
        `offerId=${expired.offerId} | ` +
        `driverId=${expired.driverId}`,
      );

      const state =
        await this.matchingService.getMatchingState(
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

      await this.scheduleNextMatchingScan(
        0,
        'OFFER_EXPIRED',
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

      const state =
        await this.matchingService.getMatchingState(
          rideId,
        );

      if (
        !state.exists ||
        !state.searching
      ) {
        return;
      }

      await this.scheduleNextMatchingScan(
        this.MATCHING_RETRY_MS,
        'TIMEOUT_ERROR',
      );
    }
  }


  private async scheduleNextMatchingScan(
    delayMs: number,
    reason: string,
  ): Promise<void> {
    await this.rideMatchingQueue.addMatchingJob(
      delayMs,
    );

    this.logger.debug(
      `NEXT MATCHING SCAN SCHEDULED | ` +
      `delay=${delayMs}ms | ` +
      `reason=${reason}`,
    );
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
  ): void {
    const ride = offer.ride;

    this.realtimeService.sendDriverOffer(
      offer.driver.id,
      {
        offerId:offer.id,
        rideId:ride.id,

        pickup: {
          latitude:Number(ride.pickupLat),
          longitude:Number(ride.pickupLng),
        },

        destination: {
          latitude:Number(ride.destinationLat),
          longitude:Number(ride.destinationLng),
        },

        geometry,

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


  private getErrorMessage(
    error: unknown,
  ): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
