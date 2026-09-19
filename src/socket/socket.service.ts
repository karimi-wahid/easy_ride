import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  Namespace,
  Socket,
} from 'socket.io';

import {
  REALTIME_EVENTS,
  SOCKET_ROOMS,
} from './socket.constants';

import { RideOfferEvent } from './events/ride-offer.events';
import { RideAcceptedEvent } from './events/ride-accepted.event';
import { DriverLocationEvent } from './events/driver-location.event';
import { RideStateChangedEvent } from './events/ride-state-changed.event';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(
    RealtimeService.name,
  );

  private namespace?: Namespace;

  /**
   * Called by RealtimeGateway after
   * the Socket.IO namespace is initialized.
   */
  setServer(namespace: Namespace): void {
    this.namespace = namespace;

    this.logger.log(
      'Socket.IO /rides namespace registered',
    );
  }

  /**
   * Send a ride offer only to the
   * specified driver.
   *
   * Room:
   * driver:{driverId}
   */
  sendDriverOffer(
    driverId: string,
    payload: RideOfferEvent,
  ): void {
    this.ensureServer();

    const room = SOCKET_ROOMS.driver(
      driverId,
    );

    this.namespace!
      .to(room)
      .emit(
        REALTIME_EVENTS.RIDE_OFFER,
        payload,
      );

    this.logger.log(
      `RIDE OFFER SENT | ` +
        `driverId=${driverId} | ` +
        `rideId=${payload.rideId} | ` +
        `offerId=${payload.offerId} | ` +
        `room=${room}`,
    );
  }

  /**
   * Notify the rider that a driver
   * accepted the ride.
   *
   * Room:
   * user:{userId}
   */
  notifyRideAccepted(
    userId: string,
    payload: RideAcceptedEvent,
  ): void {
    this.ensureServer();

    const room = SOCKET_ROOMS.user(
      userId,
    );

    this.namespace!
      .to(room)
      .emit(
        REALTIME_EVENTS.RIDE_ACCEPTED,
        payload,
      );

    this.logger.log(
      `RIDE ACCEPTED NOTIFICATION SENT | ` +
        `userId=${userId} | ` +
        `rideId=${payload.rideId} | ` +
        `room=${room}`,
    );
  }

  /**
   * Notify everyone currently connected
   * to the ride room about the accepted ride.
   *
   * Room:
   * ride:{rideId}
   */
  notifyRideDriverAssigned(
    rideId: string,
    payload: RideAcceptedEvent,
  ): void {
    this.ensureServer();

    const room = SOCKET_ROOMS.ride(
      rideId,
    );

    this.namespace!
      .to(room)
      .emit(
        REALTIME_EVENTS.RIDE_DRIVER_ASSIGNED,
        payload,
      );

    this.logger.log(
      `DRIVER ASSIGNED SENT | ` +
        `rideId=${rideId} | ` +
        `driverId=${payload.driver.id} | ` +
        `room=${room}`,
    );
  }

  /**
   * Broadcast driver location
   * to everyone in the ride room.
   */
  notifyDriverLocation(
    rideId: string,
    payload: DriverLocationEvent,
  ): void {
    this.ensureServer();

    const room = SOCKET_ROOMS.ride(
      rideId,
    );

    this.namespace!
      .to(room)
      .emit(
        REALTIME_EVENTS.DRIVER_LOCATION,
        payload,
      );

    this.logger.debug(
      `DRIVER LOCATION SENT | ` +
        `rideId=${rideId} | ` +
        `driverId=${payload.driverId} | ` +
        `lat=${payload.latitude} | ` +
        `lng=${payload.longitude} | ` +
        `room=${room}`,
    );
  }

  /**
   * Broadcast ride state changes
   * to everyone in the ride room.
   */
  notifyRideStateChanged(
    rideId: string,
    payload: RideStateChangedEvent,
  ): void {
    this.ensureServer();

    const room = SOCKET_ROOMS.ride(
      rideId,
    );

    this.namespace!
      .to(room)
      .emit(
        REALTIME_EVENTS.RIDE_STATE_CHANGED,
        payload,
      );

    this.logger.log(
      `RIDE STATE CHANGED SENT | ` +
        `rideId=${rideId} | ` +
        `room=${room} | ` +
        `status=${payload.status}`,
    );
  }

  /**
   * Tell a driver that their offer expired.
   */
  notifyOfferExpired(
    driverId: string,
    payload: {
      offerId: string;
      rideId: string;
    },
  ): void {
    this.ensureServer();

    const room = SOCKET_ROOMS.driver(
      driverId,
    );

    this.namespace!
      .to(room)
      .emit(
        REALTIME_EVENTS.RIDE_OFFER_EXPIRED,
        payload,
      );

    this.logger.log(
      `RIDE OFFER EXPIRED SENT | ` +
        `driverId=${driverId} | ` +
        `rideId=${payload.rideId} | ` +
        `offerId=${payload.offerId} | ` +
        `room=${room}`,
    );
  }

  /**
   * Tell a driver that an offer was cancelled.
   */
  notifyOfferCancelled(
    driverId: string,
    payload: {
      offerId: string;
      rideId: string;
    },
  ): void {
    this.ensureServer();

    const room = SOCKET_ROOMS.driver(
      driverId,
    );

    this.namespace!
      .to(room)
      .emit(
        REALTIME_EVENTS.RIDE_OFFER_CANCELLED,
        payload,
      );

    this.logger.log(
      `RIDE OFFER CANCELLED SENT | ` +
        `driverId=${driverId} | ` +
        `rideId=${payload.rideId} | ` +
        `offerId=${payload.offerId} | ` +
        `room=${room}`,
    );
  }

  /**
   * Tell the rider that a driver rejected
   * their offer.
   */
  notifyRideRejected(
    userId: string,
    payload: {
      rideId: string;
      offerId: string;
      driverId: string;
      reason?: string;
    },
  ): void {
    this.ensureServer();

    const room = SOCKET_ROOMS.user(
      userId,
    );

    this.namespace!
      .to(room)
      .emit(
        REALTIME_EVENTS.RIDE_REJECTED,
        payload,
      );

    this.logger.log(
      `RIDE REJECTED SENT | ` +
        `userId=${userId} | ` +
        `rideId=${payload.rideId} | ` +
        `offerId=${payload.offerId} | ` +
        `room=${room}`,
    );
  }

  /**
   * Join a ride-specific room.
   */
  async joinRide(
    socket: Socket,
    rideId: string,
  ): Promise<void> {
    const room = SOCKET_ROOMS.ride(
      rideId,
    );

    await socket.join(room);

    this.logger.log(
      `SOCKET JOINED RIDE | ` +
        `socket=${socket.id} | ` +
        `rideId=${rideId} | ` +
        `room=${room}`,
    );
  }

  /**
   * Leave a ride-specific room.
   */
  async leaveRide(
    socket: Socket,
    rideId: string,
  ): Promise<void> {
    const room = SOCKET_ROOMS.ride(
      rideId,
    );

    await socket.leave(room);

    this.logger.log(
      `SOCKET LEFT RIDE | ` +
        `socket=${socket.id} | ` +
        `rideId=${rideId} | ` +
        `room=${room}`,
    );
  }

  /**
   * Driver's permanent realtime room.
   */
  async joinDriver(
    socket: Socket,
    driverId: string,
  ): Promise<void> {
    const room = SOCKET_ROOMS.driver(
      driverId,
    );

    await socket.join(room);

    this.logger.log(
      `DRIVER ROOM JOINED | ` +
        `socket=${socket.id} | ` +
        `driverId=${driverId} | ` +
        `room=${room}`,
    );
  }

  /**
   * User's permanent realtime room.
   */
  async joinUser(
    socket: Socket,
    userId: string,
  ): Promise<void> {
    const room = SOCKET_ROOMS.user(
      userId,
    );

    await socket.join(room);

    this.logger.log(
      `USER ROOM JOINED | ` +
        `socket=${socket.id} | ` +
        `userId=${userId} | ` +
        `room=${room}`,
    );
  }

  isDriverConnected(
    driverId: string,
  ): boolean {
    this.ensureServer();

    const room = SOCKET_ROOMS.driver(
      driverId,
    );

    return (
      (this.namespace!.adapter.rooms.get(
        room,
      )?.size ?? 0) > 0
    );
  }

  isUserConnected(
    userId: string,
  ): boolean {
    this.ensureServer();

    const room = SOCKET_ROOMS.user(
      userId,
    );

    return (
      (this.namespace!.adapter.rooms.get(
        room,
      )?.size ?? 0) > 0
    );
  }

  isRideConnected(
    rideId: string,
  ): boolean {
    this.ensureServer();

    const room = SOCKET_ROOMS.ride(
      rideId,
    );

    return (
      (this.namespace!.adapter.rooms.get(
        room,
      )?.size ?? 0) > 0
    );
  }

  getRoomSize(
    room: string,
  ): number {
    this.ensureServer();

    return (
      this.namespace!.adapter.rooms.get(
        room,
      )?.size ?? 0
    );
  }

  private ensureServer(): void {
    if (!this.namespace) {
      throw new BadRequestException(
        'Realtime /rides namespace is not initialized',
      );
    }
  }
}
