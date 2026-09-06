import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {RIDE_MATCHING_QUEUE,RideMatchingQueue,} from './ride-matching.queue';
import { MatchingService } from './matching.service';
import { MatchingWorker } from './matching.worker';
import { RideOfferService } from './ride-offer.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: RIDE_MATCHING_QUEUE,
    }),
  ],

  providers: [
    MatchingService,
    MatchingWorker,
    RideMatchingQueue,
    RideOfferService,
  ],

  exports: [
    MatchingService,
    RideMatchingQueue,
  ],
})
export class MatchingModule {}
