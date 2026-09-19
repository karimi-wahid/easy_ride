import { Injectable } from '@nestjs/common';
import {
  InjectQueue,
} from '@nestjs/bullmq';
import {
  Queue,
} from 'bullmq';

export const RIDE_MATCHING_QUEUE =
  'ride-matching';

export const RIDE_MATCHING_JOB =
  'find-nearby-drivers';

export const RIDE_OFFER_TIMEOUT_JOB =
  'ride-offer-timeout';

export interface RideMatchingJobData {
  rideId: string;
}

export interface RideOfferTimeoutJobData {
  rideId: string;
  offerId: string;
}

@Injectable()
export class RideMatchingQueue {
  constructor(
    @InjectQueue(RIDE_MATCHING_QUEUE)
    private readonly queue: Queue,
  ) {}

  /**
   * Start or continue matching for a ride.
   *
   * Only one matching job for the same ride
   * should be waiting/active at a time.
   *
   * A deterministic jobId prevents duplicate
   * matching jobs from being inserted when
   * multiple events trigger matching together.
   */
  async addMatchingJob(
    rideId: string,
    delayMs = 0,
  ): Promise<void> {
    const jobId =
      `ride-matching-${rideId}`;

    const existing =
      await this.queue.getJob(jobId);

    if (existing) {
      const state =
        await existing.getState();

      /**
       * Keep an existing waiting, delayed or
       * active matching job.
       */
      if (
        state === 'waiting' ||
        state === 'delayed' ||
        state === 'active'
      ) {
        return;
      }

      /**
       * Remove completed/failed old job so a
       * new matching cycle can use the same
       * deterministic id.
       */
      await existing.remove();
    }

    await this.queue.add(
      RIDE_MATCHING_JOB,
      {
        rideId,
      } satisfies RideMatchingJobData,
      {
        jobId,

        delay: Math.max(0, delayMs),

        attempts: 3,

        backoff: {
          type: 'exponential',
          delay: 1000,
        },

        removeOnComplete: 100,

        removeOnFail: 1000,
      },
    );
  }

  /**
   * Schedule exactly one timeout for one offer.
   *
   * The offer ID is part of the deterministic
   * BullMQ job ID.
   */
  async scheduleOfferTimeout(
    rideId: string,
    offerId: string,
    delayMs = 10_000,
  ): Promise<void> {
    const jobId =
      `ride-offer-timeout-${offerId}`;

    const existing =
      await this.queue.getJob(jobId);

    if (existing) {
      const state =
        await existing.getState();

      /**
       * Never create a second timeout for
       * the same offer.
       */
      if (
        state === 'waiting' ||
        state === 'delayed' ||
        state === 'active'
      ) {
        return;
      }

      /**
       * A completed/failed old timeout can
       * be removed before recreating it.
       */
      await existing.remove();
    }

    await this.queue.add(
      RIDE_OFFER_TIMEOUT_JOB,
      {
        rideId,
        offerId,
      } satisfies RideOfferTimeoutJobData,
      {
        jobId,

        delay: Math.max(0, delayMs),

        attempts: 3,

        backoff: {
          type: 'exponential',
          delay: 1000,
        },

        removeOnComplete: 100,

        removeOnFail: 1000,
      },
    );
  }
}
