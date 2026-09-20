import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';

import {
  Logger,
  ValidationPipe,
} from '@nestjs/common';

import {
  Namespace,
  Socket,
} from 'socket.io';

import { RealtimeService } from './socket.service';
import { REALTIME_EVENTS } from './socket.constants';

import { AcceptRideDto } from './dto/accept-ride.dto';
import { RejectRideDto } from './dto/reject-ride.dto';
import { JoinRideDto } from './dto/join-ride.dto';
import { LeaveRideDto } from './dto/leave-ride.dto';
import { DriverLocationDto } from './dto/driver-location.dto';

import { RidesService } from '../rides/rides.service';
import { DriversService } from '../drivers/drivers.service';
import { SocketAuthMiddleware } from './socket-auth.middleware';

import { RideStatus } from '../shared/types/ride-status.enum';

type SocketIdentity =
  | {
      type: 'driver';
      id: string;
    }
  | {
      type: 'user';
      id: string;
    };

type RideRealtimeStatus =
  | 'SEARCHING'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_ARRIVING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

@WebSocketGateway({
  namespace: '/rides',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class RealtimeGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect
{
  private readonly logger = new Logger(
    RealtimeGateway.name,
  );

  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly ridesService: RidesService,
    private readonly socketAuthMiddleware: SocketAuthMiddleware,
    private readonly driversService: DriversService,
  ) {}

  afterInit(server: Namespace): void {
    this.server = server;

    this.realtimeService.setServer(server);

    server.use(
      (
        client: Socket,
        next: (err?: Error) => void,
      ) => {
        void this.socketAuthMiddleware.authenticate(
          client,
          next,
        );
      },
    );

    this.logger.log(
      'Ride realtime gateway initialized | namespace=/rides',
    );
  }

  handleConnection(client: Socket): void {
    const identity =
      client.data.identity as
        | SocketIdentity
        | undefined;

    if (!identity) {
      this.logger.warn(
        `UNAUTHENTICATED SOCKET | socket=${client.id}`,
      );

      client.disconnect(true);
      return;
    }

    if (identity.type === 'driver') {
      void this.realtimeService
        .joinDriver(
          client,
          identity.id,
        )
        .catch((error) => {
          this.logger.error(
            `FAILED TO JOIN DRIVER ROOM | ` +
              `driverId=${identity.id} | ` +
              `error=${this.getErrorMessage(error)}`,
          );

          client.disconnect(true);
        });

      this.logger.log(
        `DRIVER CONNECTED | ` +
          `socket=${client.id} | ` +
          `driverId=${identity.id}`,
      );
    }

    if (identity.type === 'user') {
      void this.realtimeService
        .joinUser(
          client,
          identity.id,
        )
        .catch((error) => {
          this.logger.error(
            `FAILED TO JOIN USER ROOM | ` +
              `userId=${identity.id} | ` +
              `error=${this.getErrorMessage(error)}`,
          );

          client.disconnect(true);
        });

      this.logger.log(
        `USER CONNECTED | ` +
          `socket=${client.id} | ` +
          `userId=${identity.id}`,
      );
    }

    this.logger.log(
      `SOCKET CONNECTED | ` +
        `socket=${client.id} | ` +
        `type=${identity.type} | ` +
        `id=${identity.id}`,
    );
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(
      `SOCKET DISCONNECTED | ` +
        `socket=${client.id}`,
    );
  }

  @SubscribeMessage(
    REALTIME_EVENTS.ACCEPT_RIDE,
  )
  async acceptRide(
    @ConnectedSocket()
    client: Socket,

    @MessageBody(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    )
    dto: AcceptRideDto,
  ) {
    try {
      const identity =
        this.getIdentity(client);

      if (identity.type !== 'driver') {
        throw new WsException(
          'Only drivers can accept rides',
        );
      }

      const result =
        await this.ridesService.acceptRideOffer(
          identity.id,
          dto,
        );

      const ride = result.ride;

      const acceptedAt =
        new Date().toISOString();

      /*
       * Notify passenger that driver accepted.
       */
      const acceptedPayload = {
        rideId: ride.id,

        driver: {
          id: identity.id,
        },

        acceptedAt,
      };

      this.realtimeService.notifyRideAccepted(
        ride.userId,
        acceptedPayload,
      );

      /*
       * Notify ride room that driver has been assigned.
       */
      this.realtimeService.notifyRideDriverAssigned(
        ride.id,
        acceptedPayload,
      );

      /*
       * Notify ride status change.
       */
      this.realtimeService.notifyRideStateChanged(
        ride.id,
        {
          rideId: ride.id,

          previousStatus:
            this.toRealtimeStatus(
              result.previousStatus,
            ),

          status: 'DRIVER_ASSIGNED',

          changedAt: acceptedAt,
        },
      );

      /*
       * ROUTE 1
       *
       * Driver current location -> Pickup.
       */
      this.realtimeService.notifyRideRoute(
        ride.id,
        {
          rideId: ride.id,

          phase: 'DRIVER_TO_PICKUP',

          route:
            result.driverToPickupRoute,
        },
      );

      /*
       * ROUTE 2
       *
       * Pickup -> Destination.
       */
      this.realtimeService.notifyRideRoute(
        ride.id,
        {
          rideId: ride.id,

          phase:
            'PICKUP_TO_DESTINATION',

          route:
            result.pickupToDestinationRoute,
        },
      );

      this.logger.log(
        `RIDE ACCEPTED | ` +
          `driverId=${identity.id} | ` +
          `rideId=${ride.id} | ` +
          `offerId=${result.offer.id} | ` +
          `driverToPickupDistance=${result.driverToPickupRoute.distance} | ` +
          `pickupToDestinationDistance=${result.pickupToDestinationRoute.distance}`,
      );

      /*
       * Return both routes to the socket client
       * that accepted the ride.
       */
      return {
        success: true,

        rideId: ride.id,

        offerId: result.offer.id,

        status: ride.status,

        driverToPickupRoute:
          result.driverToPickupRoute,

        pickupToDestinationRoute:
          result.pickupToDestinationRoute,
      };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage(
    REALTIME_EVENTS.JOIN_RIDE,
  )
  async joinRide(
    @ConnectedSocket()
    client: Socket,

    @MessageBody(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    )
    dto: JoinRideDto,
  ) {
    try {
      const identity =
        this.getIdentity(client);

      const ride =
        await this.ridesService.getRideForRealtime(
          dto.rideId,
        );

      const allowed =
        identity.type === 'driver'
          ? ride.driverId === identity.id
          : ride.userId === identity.id;

      if (!allowed) {
        throw new WsException(
          'You are not part of this ride',
        );
      }

      await this.realtimeService.joinRide(
        client,
        dto.rideId,
      );

      this.logger.log(
        `RIDE ROOM JOINED | ` +
          `socket=${client.id} | ` +
          `rideId=${dto.rideId} | ` +
          `type=${identity.type} | ` +
          `id=${identity.id}`,
      );

      return {
        success: true,

        rideId: dto.rideId,

        room: `ride:${dto.rideId}`,
      };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage(
    REALTIME_EVENTS.LEAVE_RIDE,
  )
  async leaveRide(
    @ConnectedSocket()
    client: Socket,

    @MessageBody(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    )
    dto: LeaveRideDto,
  ) {
    try {
      const identity =
        this.getIdentity(client);

      const ride =
        await this.ridesService.getRideForRealtime(
          dto.rideId,
        );

      const allowed =
        identity.type === 'driver'
          ? ride.driverId === identity.id
          : ride.userId === identity.id;

      if (!allowed) {
        throw new WsException(
          'You are not part of this ride',
        );
      }

      await this.realtimeService.leaveRide(
        client,
        dto.rideId,
      );

      this.logger.log(
        `RIDE ROOM LEFT | ` +
          `socket=${client.id} | ` +
          `rideId=${dto.rideId} | ` +
          `type=${identity.type} | ` +
          `id=${identity.id}`,
      );

      return {
        success: true,

        rideId: dto.rideId,
      };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage(
    REALTIME_EVENTS.REJECT_RIDE,
  )
  async rejectRide(
    @ConnectedSocket()
    client: Socket,

    @MessageBody(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    )
    dto: RejectRideDto,
  ) {
    try {
      const identity =
        this.getIdentity(client);

      if (identity.type !== 'driver') {
        throw new WsException(
          'Only drivers can reject rides',
        );
      }

      const ride =
        await this.ridesService.getRideForRealtime(
          dto.rideId,
        );

      const offer =
        await this.ridesService.rejectOffer(
          dto.rideId,
          dto.offerId,
          identity.id,
        );

      this.realtimeService.notifyRideRejected(
        ride.userId,
        {
          rideId: dto.rideId,
          offerId: dto.offerId,
          driverId: identity.id,
          reason: dto.reason,
        },
      );

      this.realtimeService.notifyOfferCancelled(
        identity.id,
        {
          offerId: dto.offerId,
          rideId: dto.rideId,
        },
      );

      this.logger.log(
        `RIDE OFFER REJECTED | ` +
          `driverId=${identity.id} | ` +
          `rideId=${dto.rideId} | ` +
          `offerId=${dto.offerId}`,
      );

      return {
        success: true,

        offerId: offer.id,

        rideId: dto.rideId,

        status: offer.status,
      };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  @SubscribeMessage(
    REALTIME_EVENTS.DRIVER_LOCATION_UPDATE,
  )
  async driverLocation(
    @ConnectedSocket()
    client: Socket,

    @MessageBody(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    )
    dto: DriverLocationDto,
  ) {
    try {
      const identity =
        this.getIdentity(client);

      if (identity.type !== 'driver') {
        throw new WsException(
          'Only drivers can send location',
        );
      }

      const ride =
        await this.ridesService.getRideForRealtime(
          dto.rideId,
        );

      if (
        ride.driverId !== identity.id
      ) {
        throw new WsException(
          'Driver is not assigned to this ride',
        );
      }

      if (
        ride.status !==
          RideStatus.ACCEPTED &&
        ride.status !==
          RideStatus.DRIVER_ARRIVING &&
        ride.status !==
          RideStatus.IN_PROGRESS
      ) {
        throw new WsException(
          'Ride is not active',
        );
      }

      await this.driversService.updateLocation(
        identity.id,
        {
          lat: dto.latitude,
          lng: dto.longitude,
        },
      );

      this.realtimeService.notifyDriverLocation(
        dto.rideId,
        {
          rideId: dto.rideId,
          driverId: identity.id,
          latitude: dto.latitude,
          longitude: dto.longitude,
          timestamp: dto.timestamp,
        },
      );

      this.logger.debug(
        `DRIVER LOCATION UPDATED | ` +
          `driverId=${identity.id} | ` +
          `rideId=${dto.rideId} | ` +
          `lat=${dto.latitude} | ` +
          `lng=${dto.longitude}`,
      );

      return {
        success: true,

        rideId: dto.rideId,

        timestamp: dto.timestamp,
      };
    } catch (error) {
      throw this.toWsException(error);
    }
  }

  private getIdentity(
    client: Socket,
  ): SocketIdentity {
    const identity =
      client.data.identity as
        | SocketIdentity
        | undefined;

    if (!identity) {
      throw new WsException(
        'Socket is not authenticated',
      );
    }

    if (
      identity.type !== 'driver' &&
      identity.type !== 'user'
    ) {
      throw new WsException(
        'Invalid socket identity',
      );
    }

    if (!identity.id) {
      throw new WsException(
        'Socket identity is missing id',
      );
    }

    return identity;
  }

  private toRealtimeStatus(
    status: RideStatus,
  ): RideRealtimeStatus {
    switch (status) {
      case RideStatus.SEARCHING:
        return 'SEARCHING';

      case RideStatus.ACCEPTED:
        return 'DRIVER_ASSIGNED';

      case RideStatus.DRIVER_ARRIVING:
        return 'DRIVER_ARRIVING';

      case RideStatus.IN_PROGRESS:
        return 'IN_PROGRESS';

      case RideStatus.COMPLETED:
        return 'COMPLETED';

      case RideStatus.CANCELLED:
        return 'CANCELLED';

      default:
        return 'SEARCHING';
    }
  }

  private toWsException(
    error: unknown,
  ): WsException {
    if (error instanceof WsException) {
      return error;
    }

    if (error instanceof Error) {
      return new WsException(
        error.message,
      );
    }

    return new WsException(
      'WebSocket request failed',
    );
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
