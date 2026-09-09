import {Injectable,NotFoundException,} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Ride } from '../../database/entities/ride.entity';
import { Driver } from '../../database/entities/driver.entity';
import { RideOffer } from '../../database/entities/ride-driver-offer.entity';
import { OfferStatus } from '../../shared/types/offer-status.enum';
import { RideStatus } from '../../shared/types/ride-status.enum';

@Injectable()
export class RideOfferService {
  constructor(
    private readonly em: EntityManager,
  ) {}

  async createOffers( rideId: string, drivers: Driver[], expirationSeconds = 15,
  ): Promise<RideOffer[]> {

    const em = this.em.fork();
    const ride = await em.findOne(
      Ride,
      {
        id: rideId,
        status: RideStatus.SEARCHING,
        driverId: null,
      },
    );

    if (!ride) {
      throw new NotFoundException(
        'Searching ride not found',
      );
    }

    if (drivers.length === 0) {
      return [];
    }

    const expiresAt = new Date(Date.now() +expirationSeconds * 1000, );
    const offers: RideOffer[] = [];

    for (const driver of drivers) {
      const existingOffer =
        await em.findOne(
          RideOffer,
          {
            ride,
            driver,
          },
        );

      if (existingOffer) {
        continue;
      }

      const offer = em.create(  RideOffer,  {
          ride,
          driver,
          status: OfferStatus.PENDING,
          expiresAt,
          createdAt: new Date(),
        },
      );

      em.persist(offer);
      offers.push(offer);
    }

    if (offers.length > 0) {
      await em.flush();
    }return offers;
  }

  async findPendingOffer(
    rideId: string,
    driverId: string,
  ): Promise<RideOffer | null> {
    const em = this.em.fork();

    const offer = await em.findOne(
      RideOffer,
      {
        ride: rideId,
        driver: driverId,
        status: OfferStatus.PENDING,
      },
    );

    if (!offer) {
      return null;
    }

    if (offer.expiresAt <= new Date()) {
      offer.status = OfferStatus.EXPIRED;
      await em.flush();
      return null;
    }
    return offer;
  }

  async expireOffer( offer: RideOffer,): Promise<void> {
    if ( offer.status !== OfferStatus.PENDING ) {
      return;
    }

    const em = this.em.fork();
    const managedOffer =await em.findOne(RideOffer,{id: offer.id, },);

    if (!managedOffer) {
      return;
    }

    if (managedOffer.status !==OfferStatus.PENDING) {
      return;
    }

    managedOffer.status =OfferStatus.EXPIRED;
    await em.flush();
  }
}
