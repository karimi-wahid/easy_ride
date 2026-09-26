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
import { Logger, ValidationPipe } from '@nestjs/common';
import { Namespace, Socket } from 'socket.io';
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
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

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

    server.use((client: Socket, next: (err?: Error) => void) => {
      void this.socketAuthMiddleware.authenticate(client, next);
    });

    this.logger.log('Ride realtime gateway initialized | namespace=/rides');
  }

  handleConnection(client: Socket): void {
    const identity = client.data.identity as SocketIdentity | undefined;

    if (!identity) {
      this.logger.warn(`UNAUTHENTICATED SOCKET | socket=${client.id}`);

      client.disconnect(true);
      return;
    }

    this.logger.log(
      `SOCKET CONNECTED | ` +
        `socket=${client.id} | ` +
        `type=${identity.type} | ` +
        `id=${identity.id}`,
    );

    if (identity.type === 'driver') {
      void this.joinDriverRoom(client, identity.id);
      return;
    }

    if (identity.type === 'user') {
      void this.joinUserRoom(client, identity.id);
      return;
    }

    this.logger.warn(`INVALID SOCKET IDENTITY | ` + `socket=${client.id}`);

    client.disconnect(true);
  }

  private async joinDriverRoom(
    client: Socket,
    driverId: string,
  ): Promise<void> {
    try {
      await this.realtimeService.joinDriver(client, driverId);

      this.logger.log(
        `DRIVER ROOM READY | ` +
          `socket=${client.id} | ` +
          `driverId=${driverId}`,
      );
    } catch (error) {
      this.logger.error(
        `FAILED TO JOIN DRIVER ROOM | ` +
          `socket=${client.id} | ` +
          `driverId=${driverId} | ` +
          `error=${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );

      client.disconnect(true);
    }
  }

  private async joinUserRoom(client: Socket, userId: string): Promise<void> {
    try {
      await this.realtimeService.joinUser(client, userId);

      this.logger.log(
        `USER ROOM READY | ` + `socket=${client.id} | ` + `userId=${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `FAILED TO JOIN USER ROOM | ` +
          `socket=${client.id} | ` +
          `userId=${userId} | ` +
          `error=${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );

      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`SOCKET DISCONNECTED | ` + `socket=${client.id}`);
  }

  @SubscribeMessage(REALTIME_EVENTS.ACCEPT_RIDE)
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
      const identity = this.getIdentity(client);

      if (identity.type !== 'driver') {
        throw new WsException('Only drivers can accept rides');
      }

      const result = await this.ridesService.acceptRideOffer(identity.id, dto);

      const ride = result.ride;

      const acceptedAt = new Date().toISOString();

      const acceptedPayload = {
        rideId: ride.id,

        driver: {
          id: identity.id,
        },

        acceptedAt,
      };

      this.realtimeService.notifyRideAccepted(ride.userId, acceptedPayload);

      this.realtimeService.notifyRideDriverAssigned(ride.id, acceptedPayload);

      this.realtimeService.notifyRideStateChanged(ride.id, {
        rideId: ride.id,

        previousStatus: this.toRealtimeStatus(result.previousStatus),

        status: 'DRIVER_ASSIGNED',

        changedAt: acceptedAt,
      });

      this.realtimeService.notifyRideRoute(ride.id, {
        rideId: ride.id,

        phase: 'DRIVER_TO_PICKUP',

        route: result.driverToPickupRoute,
      });

      this.realtimeService.notifyRideRoute(ride.id, {
        rideId: ride.id,

        phase: 'PICKUP_TO_DESTINATION',

        route: result.pickupToDestinationRoute,
      });

      this.logger.log(
        `RIDE ACCEPTED | ` +
          `driverId=${identity.id} | ` +
          `rideId=${ride.id} | ` +
          `offerId=${result.offer.id}`,
      );

      return {
        success: true,

        rideId: ride.id,

        offerId: result.offer.id,

        status: ride.status,

        driverToPickupRoute: result.driverToPickupRoute,

        pickupToDestinationRoute: result.pickupToDestinationRoute,
      };
    } catch (error) {
      this.logger.error(
        `ACCEPT RIDE FAILED | ` +
          `socket=${client.id} | ` +
          `error=${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );

      throw this.toWsException(error);
    }
  }

  @SubscribeMessage(REALTIME_EVENTS.JOIN_RIDE)
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
      const identity = this.getIdentity(client);

      this.logger.debug(
        `JOIN RIDE REQUEST | ` +
          `socket=${client.id} | ` +
          `type=${identity.type} | ` +
          `id=${identity.id} | ` +
          `rideId=${dto.rideId}`,
      );

      /*
       * Load the ride.
       *
       * RidesService.getRideForRealtime()
       * MUST use this.em.fork().
       */
      let ride;

      try {
        ride = await this.ridesService.getRideForRealtime(dto.rideId);
      } catch (error) {
        this.logger.error(
          `JOIN RIDE FAILED WHILE LOADING RIDE | ` +
            `socket=${client.id} | ` +
            `rideId=${dto.rideId} | ` +
            `type=${identity.type} | ` +
            `id=${identity.id} | ` +
            `error=${this.getErrorMessage(error)}`,
          this.getErrorStack(error),
        );

        throw error;
      }

      /*
       * Check that the authenticated socket
       * actually belongs to this ride.
       *
       * Driver:
       *     ride.driverId === socket driver id
       *
       * User:
       *     ride.userId === socket user id
       */
      const allowed =
        identity.type === 'driver'
          ? ride.driverId === identity.id
          : ride.userId === identity.id;

      if (!allowed) {
        this.logger.warn(
          `RIDE ROOM ACCESS DENIED | ` +
            `socket=${client.id} | ` +
            `rideId=${dto.rideId} | ` +
            `type=${identity.type} | ` +
            `id=${identity.id} | ` +
            `rideUserId=${ride.userId} | ` +
            `rideDriverId=${ride.driverId}`,
        );

        throw new WsException('You are not part of this ride');
      }

      /*
       * Only after authorization do we
       * join the Socket.IO room.
       */
      try {
        await this.realtimeService.joinRide(client, dto.rideId);
      } catch (error) {
        this.logger.error(
          `JOIN RIDE FAILED WHILE JOINING SOCKET ROOM | ` +
            `socket=${client.id} | ` +
            `rideId=${dto.rideId} | ` +
            `room=ride:${dto.rideId} | ` +
            `type=${identity.type} | ` +
            `id=${identity.id} | ` +
            `error=${this.getErrorMessage(error)}`,
          this.getErrorStack(error),
        );

        throw error;
      }

      this.logger.log(
        `RIDE ROOM JOINED | ` +
          `socket=${client.id} | ` +
          `rideId=${dto.rideId} | ` +
          `type=${identity.type} | ` +
          `id=${identity.id}`,
      );

      // Read again AFTER joining the room.
      // Acceptance may have happened between the first read and the join.
      const currentRide = await this.ridesService.getRideForRealtime(
        dto.rideId,
      );

      const stillAllowed =
        identity.type === 'driver'
          ? currentRide.driverId === identity.id
          : currentRide.userId === identity.id;

      if (!stillAllowed) {
        await this.realtimeService.leaveRide(client, dto.rideId);
        throw new WsException('You are not part of this ride');
      }

      const room = `ride:${currentRide.id}`;

      const isActive =
        currentRide.status === RideStatus.ACCEPTED ||
        currentRide.status === RideStatus.DRIVER_ARRIVING ||
        currentRide.status === RideStatus.IN_PROGRESS;

      // Replay routes to the authenticated socket that joined.
      // Both passengers and assigned drivers can recover their routes.
      if (currentRide.driverId && isActive) {
        void this.ridesService
          .getRideRoutesForRealtime(currentRide.id)
          .then((routes) => {
            if (!client.connected || !client.rooms.has(room)) {
              return;
            }

            if (routes.driverToPickupRoute) {
              client.emit(REALTIME_EVENTS.RIDE_ROUTE, {
                rideId: currentRide.id,
                phase: 'DRIVER_TO_PICKUP',
                route: routes.driverToPickupRoute,
              });
            }

            if (routes.pickupToDestinationRoute) {
              client.emit(REALTIME_EVENTS.RIDE_ROUTE, {
                rideId: currentRide.id,
                phase: 'PICKUP_TO_DESTINATION',
                route: routes.pickupToDestinationRoute,
              });
            }
          })
          .catch((error: unknown) => {
            this.logger.warn(
              `Route recovery failed for ride ${currentRide.id}: ${String(error)}`,
            );
          });
      }

      return {
        success: true,
        rideId: currentRide.id,
        room,

        ride: {
          id: currentRide.id,
          driverId: currentRide.driverId,
          status: currentRide.status,
          searchStartedAt: currentRide.searchStartedAt?.toISOString() ?? null,
          searchExpiresAt: currentRide.searchExpiresAt?.toISOString() ?? null,
          updatedAt: currentRide.updatedAt.toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(
        `JOIN RIDE REQUEST FAILED | ` +
          `socket=${client.id} | ` +
          `rideId=${dto.rideId} | ` +
          `error=${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );

      throw this.toWsException(error);
    }
  }

  @SubscribeMessage(REALTIME_EVENTS.LEAVE_RIDE)
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
      const identity = this.getIdentity(client);

      const ride = await this.ridesService.getRideForRealtime(dto.rideId);

      const allowed =
        identity.type === 'driver'
          ? ride.driverId === identity.id
          : ride.userId === identity.id;

      if (!allowed) {
        throw new WsException('You are not part of this ride');
      }

      await this.realtimeService.leaveRide(client, dto.rideId);

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
      this.logger.error(
        `LEAVE RIDE FAILED | ` +
          `socket=${client.id} | ` +
          `rideId=${dto.rideId} | ` +
          `error=${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );

      throw this.toWsException(error);
    }
  }

  @SubscribeMessage(REALTIME_EVENTS.REJECT_RIDE)
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
      const identity = this.getIdentity(client);

      if (identity.type !== 'driver') {
        throw new WsException('Only drivers can reject rides');
      }

      const ride = await this.ridesService.getRideForRealtime(dto.rideId);

      const offer = await this.ridesService.rejectOffer(
        dto.rideId,
        dto.offerId,
        identity.id,
      );

      this.realtimeService.notifyRideRejected(ride.userId, {
        rideId: dto.rideId,
        offerId: dto.offerId,
        driverId: identity.id,
        reason: dto.reason,
      });

      this.realtimeService.notifyOfferCancelled(identity.id, {
        offerId: dto.offerId,
        rideId: dto.rideId,
      });

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
      this.logger.error(
        `REJECT RIDE FAILED | ` +
          `socket=${client.id} | ` +
          `rideId=${dto.rideId} | ` +
          `offerId=${dto.offerId} | ` +
          `error=${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );

      throw this.toWsException(error);
    }
  }

  @SubscribeMessage(REALTIME_EVENTS.DRIVER_LOCATION_UPDATE)
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
      const identity = this.getIdentity(client);

      if (identity.type !== 'driver') {
        throw new WsException('Only drivers can send location');
      }

      const ride = await this.ridesService.getRideForRealtime(dto.rideId);

      if (ride.driverId !== identity.id) {
        throw new WsException('Driver is not assigned to this ride');
      }

      if (
        ride.status !== RideStatus.ACCEPTED &&
        ride.status !== RideStatus.DRIVER_ARRIVING &&
        ride.status !== RideStatus.IN_PROGRESS
      ) {
        throw new WsException('Ride is not active');
      }

      await this.driversService.updateLocation(identity.id, {
        lat: dto.latitude,
        lng: dto.longitude,
      });

      this.realtimeService.notifyDriverLocation(dto.rideId, {
        rideId: dto.rideId,
        driverId: identity.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        timestamp: dto.timestamp,
      });

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
      this.logger.error(
        `DRIVER LOCATION FAILED | ` +
          `socket=${client.id} | ` +
          `rideId=${dto.rideId} | ` +
          `error=${this.getErrorMessage(error)}`,
        this.getErrorStack(error),
      );

      throw this.toWsException(error);
    }
  }

  private getIdentity(client: Socket): SocketIdentity {
    const identity = client.data.identity as SocketIdentity | undefined;

    if (!identity) {
      throw new WsException('Socket is not authenticated');
    }

    if (identity.type !== 'driver' && identity.type !== 'user') {
      throw new WsException('Invalid socket identity');
    }

    if (!identity.id) {
      throw new WsException('Socket identity is missing id');
    }

    return identity;
  }

  private toRealtimeStatus(status: RideStatus): RideRealtimeStatus {
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

  private toWsException(error: unknown): WsException {
    if (error instanceof WsException) {
      return error;
    }

    if (error instanceof Error) {
      return new WsException(error.message);
    }

    return new WsException('WebSocket request failed');
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    }

    return undefined;
  }
}
