import { BadRequestException,Injectable,NotFoundException,} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { Ride } from '../database/entities/ride.entity';
import { Driver } from '../database/entities/driver.entity';
import { RideOffer } from '../database/entities/ride-driver-offer.entity';
import { RideStatus } from '../shared/types/ride-status.enum';
import { DriverStatus } from '../shared/types/driver-status.enum';
import { OfferStatus } from '../shared/types/offer-status.enum';
import { CreateRideDto } from './dto/create-ride.dto';
import { AcceptRideDto } from './socket/dto/accept-ride.dto';
import { RideMatchingQueue } from './matching/ride-matching.queue';


@Injectable()
export class RidesService {
  constructor(
    private readonly em: EntityManager,
    private readonly rideMatchingQueue: RideMatchingQueue,
  ) {}


  async createRide(userId: string,dto: CreateRideDto,): Promise<Ride> {
    this.validateLocations(dto);
    const distanceKm =this.calculateDistanceKm(dto);
    const estimatedDistanceKm = Number((distanceKm * 1.25).toFixed(2),);
    const averageSpeedKmh = 25;
    const estimatedDurationMinutes =Math.max(1,Math.ceil((estimatedDistanceKm /averageSpeedKmh) *60,),);
    const estimatedFare = Math.round(  estimatedDistanceKm * (100 / 6),);
    const ride = new Ride();
    ride.userId = userId;
    ride.driverId = null;
    ride.pickupLat = dto.pickupLat;
    ride.pickupLng = dto.pickupLng;
    ride.destinationLat =dto.destinationLat;
    ride.destinationLng =dto.destinationLng;
    ride.estimatedDistanceKm =estimatedDistanceKm;
    ride.estimatedDurationMinutes =estimatedDurationMinutes;
    ride.estimatedFare =  estimatedFare;
    ride.status = RideStatus.SEARCHING;
    this.em.persist(ride);
    await this.em.flush();
    await this.rideMatchingQueue.addMatchingJob(
      ride.id,
    );
    return ride;
  }

  
  async getAvailableRides(): Promise<Ride[]> {
    return this.em.find(Ride, {
      status: RideStatus.SEARCHING,
      driverId: null,
    });
  }




  async getRideForRealtime( rideId: string,): Promise<Ride> {
    const ride = await this.em.findOne(Ride,{
        id: rideId,
      },
    );

    if (!ride) {
      throw new NotFoundException(
        'Ride not found',
      );
    }
    return ride;
  }



  async acceptRideOffer( driverId: string, dto: AcceptRideDto, ): Promise<{
    ride: Ride;
    offer: RideOffer;
    previousStatus: RideStatus;
   }> {
    const em = this.em.fork();
    return em.transactional(async (tx) => {
      const driver =await tx.findOne( Driver,
          {
            id: driverId,
            deletedAt: null,
          },
        );

      if (!driver) {
        throw new NotFoundException(
          'Driver not found',
        );
      }

      if (driver.status !==DriverStatus.AVAILABLE) {
        throw new BadRequestException(
          'Driver is not available',
        );
      }

      const offer =await tx.findOne( RideOffer,
          {
            id: dto.offerId,
            driver: driverId,
            ride: dto.rideId,
          },
          {
            populate: ['ride'],
          },
        );

      if (!offer) {
        throw new NotFoundException(
          'Ride offer not found',
        );
      }

      if (offer.status !==  OfferStatus.PENDING ) {
        throw new BadRequestException(
          `Offer is already ${offer.status}`,
        );
      }

      if (offer.expiresAt <=new Date() ) {
          offer.status =OfferStatus.EXPIRED;
          await tx.flush();
          throw new BadRequestException(
          'Ride offer has expired',
        );
      }

      const ride = await tx.findOne(Ride,{
            id: dto.rideId,
          },
        );

      if (!ride) {
        throw new NotFoundException(
          'Ride not found',
        );
      }

      if ( ride.status !== RideStatus.SEARCHING) {
        throw new BadRequestException(
          'Ride is no longer available',
        );
      }

      if ( ride.driverId !== null) {
        throw new BadRequestException(
          'Ride is already assigned to a driver',
        );
      }

      const previousStatus =   ride.status;
      offer.status = OfferStatus.ACCEPTED;
      ride.driverId = driver.id;
      ride.status =  RideStatus.ACCEPTED;
      driver.status =   DriverStatus.BUSY;
      driver.updatedAt = new Date();
      await tx.flush();
      return {
        ride,
        offer,
        previousStatus,
      };
    });
  }



  async rejectOffer(rideId: string, offerId: string, driverId: string, ): Promise<RideOffer> {
    const offer =await this.em.findOne( RideOffer,
    {
          id: offerId,
          driver: driverId,
          ride: rideId,
        },
      );

    if (!offer) {
      throw new NotFoundException(
        'Ride offer not found',
      );
    }

    if (offer.status !== OfferStatus.PENDING ) {
      throw new BadRequestException(
        `Offer is already ${offer.status}`,
      );
    }

    if (offer.expiresAt <= new Date()) {
      offer.status =  OfferStatus.EXPIRED;
      await this.em.flush();
      throw new BadRequestException(
        'Ride offer has expired',
      );
    }

    offer.status =OfferStatus.REJECTED;
    await this.em.flush();
    return offer;
  }



  private validateLocations( dto: CreateRideDto,): void {
    if ( dto.pickupLat ===dto.destinationLat &&  dto.pickupLng ===dto.destinationLng) {
      throw new BadRequestException(
        'Pickup and destination cannot be the same',
      );
    }
  }


  private calculateDistanceKm( dto: CreateRideDto,): number {
    const earthRadiusKm = 6371;
    const lat1 =this.toRadians(dto.pickupLat);
    const lat2 =this.toRadians(dto.destinationLat,);
    const deltaLat = this.toRadians(dto.destinationLat -dto.pickupLat, );
    const deltaLng =this.toRadians(  dto.destinationLng -dto.pickupLng, );
    const a =Math.sin(  deltaLat / 2,) **  2 + Math.cos(lat1) *Math.cos(lat2) *Math.sin(deltaLng / 2,) **2;
    const c =  2 * Math.atan2(   Math.sqrt(a),   Math.sqrt(1 - a), );
    const distanceKm =earthRadiusKm * c;

    if (distanceKm <= 0) {
      throw new BadRequestException(
        'Unable to calculate ride distance',
      );
    }
    return distanceKm;
  }

 
  private toRadians(value: number, ): number {
    return (
      (value * Math.PI) / 180
    );
  }
}
