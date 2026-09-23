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

type RideRoutePhase =
  | 'DRIVER_TO_PICKUP'
  | 'PICKUP_TO_DESTINATION';

type RideRoutePayload = {
  rideId: string;

  phase: RideRoutePhase;

  route: {
    distance: number;
    duration: number;

    distanceMeters: number;
    durationSeconds: number;

    geometry?: {
      type: 'LineString';
      coordinates: number[][];
    };

    instructions: {
      text: string;
      distance: number;
      duration: number;
      type?: string;
      modifier?: string;
      location?: number[];
    }[];
  };
};

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(
    RealtimeService.name,
  );

  private namespace?: Namespace;

  setServer(namespace: Namespace): void {
    this.namespace = namespace;

    this.logger.log(
      'Socket.IO /rides namespace registered',
    );
  }

  sendDriverOffer(
    driverId: string,
    payload: RideOfferEvent,
  ): void {
    this.ensureServer();

    const room =
      SOCKET_ROOMS.driver(driverId);

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

  notifyRideAccepted(
    userId: string,
    payload: RideAcceptedEvent,
  ): void {
    this.ensureServer();

    const room =
      SOCKET_ROOMS.user(userId);

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

  notifyRideDriverAssigned(
    rideId: string,
    payload: RideAcceptedEvent,
  ): void {
    this.ensureServer();

    const room =
      SOCKET_ROOMS.ride(rideId);

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

  notifyDriverLocation(
    rideId: string,
    payload: DriverLocationEvent,
  ): void {
    this.ensureServer();

    const room =
      SOCKET_ROOMS.ride(rideId);

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

  notifyRideStateChanged(
    rideId: string,
    payload: RideStateChangedEvent,
  ): void {
    this.ensureServer();

    const room =
      SOCKET_ROOMS.ride(rideId);

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

  notifyOfferExpired(
    driverId: string,
    payload: {
      offerId: string;
      rideId: string;
    },
  ): void {
    this.ensureServer();

    const room =
      SOCKET_ROOMS.driver(driverId);

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

  notifyOfferCancelled(
    driverId: string,
    payload: {
      offerId: string;
      rideId: string;
    },
  ): void {
    this.ensureServer();

    const room =
      SOCKET_ROOMS.driver(driverId);

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

    const room =
      SOCKET_ROOMS.user(userId);

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
   * Sends a calculated route to everyone
   * inside the ride room.
   *
   * DRIVER_TO_PICKUP:
   *     Driver -> Pickup
   *
   * PICKUP_TO_DESTINATION:
   *     Pickup -> Destination
   */
  notifyRideRoute(
    rideId: string,
    payload: RideRoutePayload,
  ): void {
    this.ensureServer();

    const room =
      SOCKET_ROOMS.ride(rideId);

    this.namespace!
      .to(room)
      .emit(
        REALTIME_EVENTS.RIDE_ROUTE,
        payload,
      );

    this.logger.log(
      `RIDE ROUTE SENT | ` +
        `rideId=${rideId} | ` +
        `phase=${payload.phase} | ` +
        `distance=${payload.route.distance} | ` +
        `duration=${payload.route.duration} | ` +
        `distanceMeters=${payload.route.distanceMeters} | ` +
        `durationSeconds=${payload.route.durationSeconds} | ` +
        `coordinates=${payload.route.geometry?.coordinates.length ?? 0} | ` +
        `instructions=${payload.route.instructions.length} | ` +
        `room=${room}`,
    );
  }

  async joinRide(
    socket: Socket,
    rideId: string,
  ): Promise<void> {
    const room =
      SOCKET_ROOMS.ride(rideId);

    try {
      this.logger.debug(
        `JOIN RIDE START | ` +
          `socket=${socket.id} | ` +
          `rideId=${rideId} | ` +
          `room=${room}`,
      );

      await socket.join(room);

      this.logger.log(
        `SOCKET JOINED RIDE | ` +
          `socket=${socket.id} | ` +
          `rideId=${rideId} | ` +
          `room=${room}`,
      );
    } catch (error) {
      this.logger.error(
        `FAILED TO JOIN RIDE ROOM | ` +
          `socket=${socket.id} | ` +
          `rideId=${rideId} | ` +
          `room=${room} | ` +
          `error=${this.getErrorMessage(error)}`,
      );

      throw error;
    }
  }

  async leaveRide(
    socket: Socket,
    rideId: string,
  ): Promise<void> {
    const room =
      SOCKET_ROOMS.ride(rideId);

    try {
      await socket.leave(room);

      this.logger.log(
        `SOCKET LEFT RIDE | ` +
          `socket=${socket.id} | ` +
          `rideId=${rideId} | ` +
          `room=${room}`,
      );
    } catch (error) {
      this.logger.error(
        `FAILED TO LEAVE RIDE ROOM | ` +
          `socket=${socket.id} | ` +
          `rideId=${rideId} | ` +
          `room=${room} | ` +
          `error=${this.getErrorMessage(error)}`,
      );

      throw error;
    }
  }

  async joinDriver(
    socket: Socket,
    driverId: string,
  ): Promise<void> {
    const room =
      SOCKET_ROOMS.driver(driverId);

    try {
      await socket.join(room);

      this.logger.log(
        `DRIVER ROOM JOINED | ` +
          `socket=${socket.id} | ` +
          `driverId=${driverId} | ` +
          `room=${room}`,
      );
    } catch (error) {
      this.logger.error(
        `FAILED TO JOIN DRIVER ROOM | ` +
          `socket=${socket.id} | ` +
          `driverId=${driverId} | ` +
          `room=${room} | ` +
          `error=${this.getErrorMessage(error)}`,
      );

      throw error;
    }
  }

  async joinUser(
    socket: Socket,
    userId: string,
  ): Promise<void> {
    const room =
      SOCKET_ROOMS.user(userId);

    try {
      await socket.join(room);

      this.logger.log(
        `USER ROOM JOINED | ` +
          `socket=${socket.id} | ` +
          `userId=${userId} | ` +
          `room=${room}`,
      );
    } catch (error) {
      this.logger.error(
        `FAILED TO JOIN USER ROOM | ` +
          `socket=${socket.id} | ` +
          `userId=${userId} | ` +
          `room=${room} | ` +
          `error=${this.getErrorMessage(error)}`,
      );

      throw error;
    }
  }

  isDriverConnected(
    driverId: string,
  ): boolean {
    this.ensureServer();

    const room =
      SOCKET_ROOMS.driver(driverId);

    return (
      (
        this.namespace!.adapter.rooms.get(
          room,
        )?.size ?? 0
      ) > 0
    );
  }

  isUserConnected(
    userId: string,
  ): boolean {
    this.ensureServer();

    const room =
      SOCKET_ROOMS.user(userId);

    return (
      (
        this.namespace!.adapter.rooms.get(
          room,
        )?.size ?? 0
      ) > 0
    );
  }

  isRideConnected(
    rideId: string,
  ): boolean {
    this.ensureServer();

    const room =
      SOCKET_ROOMS.ride(rideId);

    return (
      (
        this.namespace!.adapter.rooms.get(
          room,
        )?.size ?? 0
      ) > 0
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

  private getErrorMessage(
    error: unknown,
  ): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
