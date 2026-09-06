import {Injectable,Logger,} from '@nestjs/common';
import {Processor, WorkerHost,} from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {RIDE_MATCHING_QUEUE, RIDE_MATCHING_JOB,} from './ride-matching.queue';
import { MatchingService } from './matching.service';
import { RideOfferService } from './ride-offer.service';

@Processor(RIDE_MATCHING_QUEUE)
@Injectable()
export class MatchingWorker extends WorkerHost {
  private readonly logger = new Logger(MatchingWorker.name);

  constructor(
    private readonly matchingService: MatchingService,
    private readonly rideOfferService: RideOfferService,
  ) {super();}

  async process(job: Job<{rideId: string;}>,): Promise<void> {
    this.logger.log( ` MATCHING JOB RECEIVED | jobId=${job.id} | name=${job.name}`,);

    if (job.name !== RIDE_MATCHING_JOB) {
      this.logger.warn(` UNKNOWN JOB | name=${job.name}`,);
      return;
    }
    
    const { rideId } = job.data;
    this.logger.log(  ` MATCHING START | rideId=${rideId}`, );


    try {
      const drivers =await this.matchingService.findNearbyDrivers(rideId, 3000,);
      this.logger.log(` NEARBY DRIVERS | rideId=${rideId} | count=${drivers.length}`,);
      if (drivers.length === 0) {
        this.logger.warn(` NO DRIVERS FOUND | rideId=${rideId}`,);
        return;
      }

      this.logger.log( ` DRIVERS FOUND | ${drivers.map((driver) => driver.id).join(', ')}`,);
      const offers =await this.rideOfferService.createOffers(rideId,drivers,15,);
      this.logger.log(` OFFERS CREATED | rideId=${rideId} | count=${offers.length}`,);
      this.logger.log(` MATCHING COMPLETE | rideId=${rideId}`,);
    }
      catch (error) {
      this.logger.error(  ` MATCHING FAILED | rideId=${rideId}`,error instanceof Error? error.stack: String(error),);
      throw error;
    }
  }
}
