import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const RIDE_MATCHING_QUEUE ='ride-matching';
export const RIDE_MATCHING_JOB ='find-nearby-drivers';

@Injectable()
export class RideMatchingQueue {
  constructor(
    @InjectQueue(RIDE_MATCHING_QUEUE)
    private readonly queue: Queue,
  ) {}

  async addMatchingJob(
    rideId: string,
  ): Promise<void> {
    await this.queue.add(
      RIDE_MATCHING_JOB,
      {
        rideId,
      },
      {
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
