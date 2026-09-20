import {Injectable,} from '@nestjs/common';
import { InjectQueue,} from '@nestjs/bullmq';
import {Queue,} from 'bullmq';

export const RIDE_MATCHING_QUEUE ='ride-matching';
export const RIDE_MATCHING_JOB ='find-searching-rides';
export const RIDE_OFFER_TIMEOUT_JOB ='ride-offer-timeout';

export interface RideMatchingJobData {scan: true;}
export interface RideOfferTimeoutJobData { rideId: string; offerId: string;}

@Injectable()
export class RideMatchingQueue {

  constructor(
    @InjectQueue(RIDE_MATCHING_QUEUE)
    private readonly queue: Queue,
  ) {}


  async addMatchingJob(  delayMs = 0,  ): Promise<void> {
    const jobId =  `ride-matching-scan-${Date.now()}`;
    await this.queue.add( RIDE_MATCHING_JOB,
      {
        scan: true,
      } satisfies RideMatchingJobData,
      {
        jobId,
        delay: Math.max(0,delayMs,),
        attempts: 3,
        backoff: { type: 'exponential',  delay: 1000,},
        removeOnComplete: true,
        removeOnFail: {age: 60,count: 100,  },
      },
    );
  }


  async scheduleOfferTimeout(rideId: string,offerId: string,delayMs = 10_000,): Promise<void> {
    const jobId = `ride-offer-timeout-${offerId}`;
    const existing = await this.queue.getJob(jobId);

    if (existing) {
      const state =  await existing.getState();
      if (  state === 'waiting' ||  state === 'delayed' ||  state === 'active') {
        return;
      }
      try {
        await existing.remove();
      } catch {
      }
    }
    await this.queue.add(RIDE_OFFER_TIMEOUT_JOB,
      { rideId,offerId,} satisfies RideOfferTimeoutJobData,
      {
        jobId,
        delay: Math.max( 0, delayMs,   ),
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000,  },
        removeOnComplete: true,
        removeOnFail: { age: 60, count: 100, },
      },
    );
  }


  async removeMatchingJob(): Promise<void> {
    return;
  }

  
  async removeOfferTimeout( offerId: string,): Promise<void> {
    const jobId =   `ride-offer-timeout-${offerId}`;
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return;
    }
    try {
      await job.remove();
    } catch {
    }
  }
}
