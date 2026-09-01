import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { EntityManager } from '@mikro-orm/core';

import { Ride } from '../database/entities/ride.entity';
import { RideRequest } from '../database/entities/ride-request.entity';
import { RideRequestStatus } from '../shared/types/ride-request-status.enum';
import { RideStatus } from '../shared/types/ride-status.enum';

@Injectable()
export class RideRequestService {
  constructor(
    private readonly em: EntityManager,
  ) {}

  async createRequest(
    ride: Ride,
    driverId: string,
  ): Promise<RideRequest> {
    if (ride.status !== RideStatus.SEARCHING) {
      throw new BadRequestException(
        'Ride is not available',
      );
    }

    const existing = await this.em.findOne(
      RideRequest,
      {
        rideId: ride.id,
        driverId,
        status: RideRequestStatus.PENDING,
      },
    );

    if (existing) {
      return existing;
    }

    const request = new RideRequest();

    request.rideId = ride.id;
    request.driverId = driverId;
    request.status = RideRequestStatus.PENDING;
    request.expiresAt = new Date(
      Date.now() + 30 * 1000,
    );

    this.em.persist(request);
    await this.em.flush();

    return request;
  }

  async acceptRequest(
    requestId: string,
    driverId: string,
  ): Promise<Ride> {
    const request = await this.em.findOne(
      RideRequest,
      {
        id: requestId,
      },
    );

    if (!request) {
      throw new BadRequestException(
        'Ride request not found',
      );
    }

    if (request.driverId !== driverId) {
      throw new BadRequestException(
        'This request does not belong to this driver',
      );
    }

    if (
      request.status !==
      RideRequestStatus.PENDING
    ) {
      throw new BadRequestException(
        'Ride request is no longer available',
      );
    }

    if (request.expiresAt < new Date()) {
      request.status =
        RideRequestStatus.EXPIRED;

      await this.em.flush();

      throw new BadRequestException(
        'Ride request has expired',
      );
    }

    const ride = await this.em.findOne(
      Ride,
      {
        id: request.rideId,
      },
    );

    if (!ride) {
      throw new BadRequestException(
        'Ride not found',
      );
    }

    if (ride.status !== RideStatus.SEARCHING) {
      throw new BadRequestException(
        'Ride has already been accepted',
      );
    }

    request.status =
      RideRequestStatus.ACCEPTED;

    ride.driverId = driverId;
    ride.status = RideStatus.ACCEPTED;

    await this.em.flush();

    return ride;
  }

  async rejectRequest(
    requestId: string,
    driverId: string,
  ): Promise<RideRequest> {
    const request = await this.em.findOne(
      RideRequest,
      {
        id: requestId,
      },
    );

    if (!request) {
      throw new BadRequestException(
        'Ride request not found',
      );
    }

    if (request.driverId !== driverId) {
      throw new BadRequestException(
        'This request does not belong to this driver',
      );
    }

    if (
      request.status !==
      RideRequestStatus.PENDING
    ) {
      throw new BadRequestException(
        'Ride request is no longer available',
      );
    }

    request.status =
      RideRequestStatus.REJECTED;

    await this.em.flush();

    return request;
  }
}
