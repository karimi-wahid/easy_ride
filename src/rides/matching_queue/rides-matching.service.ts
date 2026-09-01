import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { DriverSession } from '../../database/entities/driver-session.entity';
import { DriverLocationService } from './driver-location.service';

@Injectable()
export class RideMatchingService {
  constructor(
    private readonly em: EntityManager,
    private readonly driverLocationService: DriverLocationService,
  ) {}

  async findNearestDriver(pickupLat: number,pickupLng: number, ): Promise<{
    driverId: string;
    distanceKm: number;
    } | null> {
  
    const now = new Date();
    const sessions = await this.em.find(DriverSession,{
        revokedAt: null,
        expiresAt: {$gt: now,},},
      {
        populate: ['driver'],
      },
    );

    let nearestDriver: {
      driverId: string;
      distanceKm: number;
    } | null = null;

    for (const session of sessions) {
      const location =
        this.driverLocationService.getLocation(
          session.driver.id,
        );

      if (!location) {
        continue;
      }

      const distanceKm =
        this.calculateDistanceKm(
          pickupLat,
          pickupLng,
          location.lat,
          location.lng,
        );

      if (distanceKm > 3) {
        continue;
      }

      if (
        nearestDriver === null ||
        distanceKm < nearestDriver.distanceKm
      ) {
        nearestDriver = {
          driverId: session.driver.id,
          distanceKm,
        };
      }
    }
    return nearestDriver;
  }

  private calculateDistanceKm( lat1: number,lng1: number,  lat2: number, lng2: number,): number {
    const earthRadiusKm = 6371;
    const latitude1 = this.toRadians(lat1);
    const latitude2 = this.toRadians(lat2);
    const deltaLatitude = this.toRadians(lat2 - lat1,);
    const deltaLongitude = this.toRadians(  lng2 - lng1,);
    const a =Math.sin(deltaLatitude / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
    const c = 2 *Math.atan2(  Math.sqrt(a),Math.sqrt(1 - a),);
    return earthRadiusKm * c;
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }
}
