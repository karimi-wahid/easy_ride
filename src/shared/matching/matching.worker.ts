import {Injectable,Logger,} from '@nestjs/common';
import { Processor, WorkerHost,} from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RIDE_MATCHING_QUEUE,RIDE_MATCHING_JOB,} from './ride-matching.queue';
import { MatchingService } from './matching.service';
import { RideOfferService } from './ride-offer.service';
import { RealtimeService } from '../../socket/socket.service';

@Processor(RIDE_MATCHING_QUEUE)
@Injectable()
export class MatchingWorker extends WorkerHost{
  private readonly logger =new Logger(MatchingWorker.name);

  constructor(
    private readonly matchingService: MatchingService,
    private readonly rideOfferService: RideOfferService,
    private readonly realtimeService: RealtimeService,
  ) {
    super();
  }


  async process( job: Job<{ rideId: string }>,
  ): Promise<void> {
    if (job.name !== RIDE_MATCHING_JOB ) {
      this.logger.warn(  `UNKNOWN JOB | name=${job.name}`,);
      return;
    }


    const { rideId } = job.data;
    this.logger.log( `MATCHING START | rideId=${rideId}`, );

    try {
      const drivers =await this.matchingService.findNearbyDrivers(
          rideId,
          3000,
        );

      if (drivers.length === 0) {
        this.logger.warn(   `NO DRIVERS FOUND | rideId=${rideId}`, );
        return;
      }

      const offers = await this.rideOfferService.createOffers(rideId,drivers,180, );
      for (const offer of offers) {
        const ride = offer.ride;


        this.realtimeService.sendDriverOffer(offer.driver.id,
          {
            offerId: offer.id,
            rideId: ride.id,
            pickup: {
              latitude: ride.pickupLat,
              longitude: ride.pickupLng,
            },

            destination: {
              latitude: ride.destinationLat,
              longitude: ride.destinationLng,
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

      this.logger.log(`MATCHING COMPLETE | rideId=${rideId} | offers=${offers.length}`,);
   
    } catch (error) {
      this.logger.error( `MATCHING FAILED | rideId=${rideId}`,
        error instanceof Error
          ? error.stack
          : String(error),
      );
      throw error;
    }
  }
}
