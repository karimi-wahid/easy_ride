import {BadRequestException,Injectable,} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { Ride } from '../database/entities/ride.entity';
import { RideStatus } from '../shared/types/ride-status.enum';
import { CreateRideDto } from './dto/create-ride.dto';


@Injectable()
export class RidesService {
  constructor( private readonly em: EntityManager,  ) {}


  async createRide(
    userId: string,
    dto: CreateRideDto,
  ): Promise<Ride> {this.validateLocations(dto);

    const distanceKm = this.calculateDistanceKm(dto);
    const estimatedDistanceKm = Number((distanceKm * 1.25).toFixed(2),);
    const averageSpeedKmh = 25;
    const estimatedDurationMinutes = Math.max(1,Math.ceil( (estimatedDistanceKm / averageSpeedKmh) * 60,),);
    const estimatedFare = Math.round(   estimatedDistanceKm * (100 / 6),);
    const ride = new Ride();
    ride.userId = userId;
    ride.driverId = null;
    ride.pickupLat = dto.pickupLat;
    ride.pickupLng = dto.pickupLng;
    ride.destinationLat = dto.destinationLat;
    ride.destinationLng = dto.destinationLng;
    ride.estimatedDistanceKm = estimatedDistanceKm;
    ride.estimatedDurationMinutes =  estimatedDurationMinutes;
    ride.estimatedFare = estimatedFare;
    ride.status = RideStatus.SEARCHING;
    this.em.persist(ride);
    await this.em.flush();
    return ride;
  }


  private validateLocations(dto: CreateRideDto, ): void {
    if (dto.pickupLat === dto.destinationLat && dto.pickupLng === dto.destinationLng){
      throw new BadRequestException(
        'Pickup and destination cannot be the same',
      );}
  }


  private calculateDistanceKm(dto: CreateRideDto,): number {
    const earthRadiusKm = 6371;
    const lat1 = this.toRadians(dto.pickupLat);
    const lat2 = this.toRadians(dto.destinationLat);
    const deltaLat = this.toRadians(  dto.destinationLat - dto.pickupLat,);
    const deltaLng = this.toRadians( dto.destinationLng - dto.pickupLng,);
    const a = Math.sin(deltaLat / 2) ** 2 +Math.cos(lat1) *  Math.cos(lat2) *Math.sin(deltaLng / 2) ** 2;
    const c =2 *Math.atan2(Math.sqrt(a),Math.sqrt(1 - a),);
    const distanceKm = earthRadiusKm * c;
    if (distanceKm <= 0) {
      throw new BadRequestException(
        'Unable to calculate ride distance',
      );}
    return distanceKm;
  }

  
  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }
}
  