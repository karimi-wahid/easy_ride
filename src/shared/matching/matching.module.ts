import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { RIDE_MATCHING_QUEUE,RideMatchingQueue,} from './ride-matching.queue';
import { MatchingService } from './matching.service';
import { MatchingWorker } from './matching.worker';
import { RideOfferService } from './ride-offer.service';
import { RealtimeModule } from '../../socket/socket.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: RIDE_MATCHING_QUEUE,
    }),
    RealtimeModule,
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
    RideOfferService,
  ],
})
export class MatchingModule {}
