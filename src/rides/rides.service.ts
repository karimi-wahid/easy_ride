import {BadRequestException,Injectable,InternalServerErrorException,} from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import {Ride,RideStatus,} from '../database/entities/ride.entity';
import { CreateRideDto } from './dto/create-ride.dto';

@Injectable()
export class RidesService {
  constructor(
    private readonly em: EntityManager,
  ) {}

  async createRide(
    userId: string,
    dto: CreateRideDto,
  ): Promise<Ride> {
    this.validateLocations(dto);
    const distanceKm = await this.calculateDistanceKm(dto);
    const estimatedDistanceKm = Number((distanceKm * 1.25).toFixed(2), );
    const averageSpeedKmh = 25;
    const estimatedDurationMinutes = Math.max(
      1,
      Math.ceil(
        (estimatedDistanceKm / averageSpeedKmh) * 60,
      ),
    );
    const estimatedFare = Math.round(estimatedDistanceKm * (100 / 6), );
    const rideId = randomUUID();
    await this.em
      .getConnection()
      .execute(
        `
        INSERT INTO rides (
          id,
          user_id,
          driver_id,
          pickup_lat,
          pickup_lng,
          destination_lat,
          destination_lng,
          estimated_distance_km,
          estimated_duration_minutes,
          estimated_fare,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `,
        [
          rideId,
          userId,
          null,
          dto.pickupLat,
          dto.pickupLng,
          dto.destinationLat,
          dto.destinationLng,
          estimatedDistanceKm,
          estimatedDurationMinutes,
          estimatedFare,
          RideStatus.SEARCHING,
        ],
      );
    return this.getRide(rideId);
  }

  private validateLocations(
    dto: CreateRideDto,
  ): void {
    if (
      dto.pickupLat === dto.destinationLat &&
      dto.pickupLng === dto.destinationLng
    ) {
      throw new BadRequestException(
        'Pickup and destination cannot be the same',
      );
    }
  }

  private async calculateDistanceKm(
    dto: CreateRideDto,
  ): Promise<number> {
    const result = await this.em
      .getConnection()
      .execute<
        { distance_meters: number }[]
      >(
        `
        SELECT ST_Distance(
          ST_SetSRID(
            ST_MakePoint(?, ?),
            4326
          )::geography,
          ST_SetSRID(
            ST_MakePoint(?, ?),
            4326
          )::geography
        ) AS distance_meters
        `,
        [
          dto.pickupLng,
          dto.pickupLat,
          dto.destinationLng,
          dto.destinationLat,
        ],
      );

    const meters = Number(
      result[0]?.distance_meters ?? 0,
    );

    if (meters <= 0) {
      throw new BadRequestException(
        'Unable to calculate ride distance',
      );
    }
    return meters / 1000;
  }

  private async getRide(
    rideId: string,
  ): Promise<Ride> {
    const result = await this.em
      .getConnection()
      .execute<any[]>(
        `
        SELECT
          id,
          user_id,
          driver_id,
          pickup_lat,
          pickup_lng,
          destination_lat,
          destination_lng,
          estimated_distance_km,
          estimated_duration_minutes,
          estimated_fare,
          status,
          created_at,
          updated_at
        FROM rides
        WHERE id = ?
        `,
        [rideId],
      );

    const row = result[0];

    if (!row) {
      throw new InternalServerErrorException(
        'Ride could not be retrieved',
      );
    }

    const ride = new Ride();
    ride.id = row.id;
    ride.userId = row.user_id;
    ride.driverId = row.driver_id;
    ride.pickupLat = Number(row.pickup_lat);
    ride.pickupLng = Number(row.pickup_lng);
    ride.destinationLat = Number(row.destination_lat,);
    ride.destinationLng = Number(row.destination_lng,);
    ride.estimatedDistanceKm =row.estimated_distance_km !== null? Number(row.estimated_distance_km): null;
    ride.estimatedDurationMinutes =row.estimated_duration_minutes !== null? Number(row.estimated_duration_minutes) : null;
    ride.estimatedFare =row.estimated_fare !== null ? Number(row.estimated_fare)  : null;
    ride.status = row.status;
    ride.createdAt = row.created_at;
    ride.updatedAt = row.updated_at;
    return ride;
  }
}
