import {ConnectedSocket, MessageBody,OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage,WebSocketGateway, WebSocketServer,WsException,} from '@nestjs/websockets';
import { Logger, ValidationPipe,} from '@nestjs/common';
import { Namespace, Socket,} from 'socket.io';
import { RealtimeService } from './socket.service';
import {REALTIME_EVENTS,} from './socket.constants';
import { RejectRideDto } from './dto/reject-ride.dto';
import { JoinRideDto } from './dto/join-ride.dto';
import { LeaveRideDto } from './dto/leave-ride.dto';
import { DriverLocationDto } from './dto/driver-location.dto';
import { RidesService } from '../rides.service';
import { SocketAuthMiddleware,} from './socket-auth.middleware';

type SocketIdentity = {type: 'driver' | 'user';id: string;};

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
  private readonly logger =  new Logger(RealtimeGateway.name);
  @WebSocketServer()
  server!: Namespace;

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly ridesService: RidesService,
    private readonly socketAuthMiddleware: SocketAuthMiddleware,
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
    this.logger.log('Ride realtime gateway initialized | namespace=/rides',);
  }



  handleConnection( client: Socket,
  ): void {
    const identity = client.data.identity as | SocketIdentity | undefined;
    if (!identity) { this.logger.warn(  `UNAUTHENTICATED SOCKET | socket=${client.id}`,);
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
          this.logger.error( `Failed to join driver room | driverId=${identity.id} | error=${this.getErrorMessage(error)}`, );
          client.disconnect(true);
        });

      this.logger.log( `DRIVER CONNECTED | socket=${client.id} | driverId=${identity.id} | room=driver:${identity.id}`,);
    }

    if (identity.type === 'user') {
      void this.realtimeService
        .joinUser(
          client,
          identity.id,
        )
        .catch((error) => {
          this.logger.error( `Failed to join user room | userId=${identity.id} | error=${this.getErrorMessage(error)}`);
          client.disconnect(true);
        });
      this.logger.log(  `USER CONNECTED | socket=${client.id} | userId=${identity.id} | room=user:${identity.id}`,
      );
    }
    this.logger.log(`SOCKET CONNECTED | socket=${client.id} | type=${identity.type} | id=${identity.id}`,
    );
  }



  handleDisconnect(
    client: Socket,
  ): void {
    this.logger.log(  `SOCKET DISCONNECTED | socket=${client.id}`,);
  }



  @SubscribeMessage(
    REALTIME_EVENTS.JOIN_RIDE,
  )
  async joinRide(
    @ConnectedSocket() client: Socket,
    @MessageBody(
      new ValidationPipe({
        transform: true,
      }),
    )
    dto: JoinRideDto,
  ) {
    try {
      const identity =this.getIdentity(client);
      const ride =await this.ridesService.getRideForRealtime(  dto.rideId,);
      const allowed =identity.type === 'driver'  ? ride.driverId === identity.id  : ride.userId === identity.id;
      if (!allowed) {
        throw new WsException(
          'You are not part of this ride',
        );
      }

      await this.realtimeService.joinRide(
        client,
        dto.rideId,
      );

      this.logger.log(`RIDE ROOM JOINED | socket=${client.id} | rideId=${dto.rideId} | type=${identity.type} | id=${identity.id}`,  );
      return {
        success: true,
        rideId: dto.rideId,
      };
    } catch (error) {
      throw this.toWsException(error);
    }
  }



  @SubscribeMessage(
    REALTIME_EVENTS.LEAVE_RIDE,
  )
  async leaveRide(
    @ConnectedSocket() client: Socket,
    @MessageBody(
      new ValidationPipe({
        transform: true,
      }),
    )
    dto: LeaveRideDto,
  ) {
    try {
      const identity =this.getIdentity(client);
      const ride =  await this.ridesService.getRideForRealtime(dto.rideId, );
      const allowed =identity.type === 'driver'  ? ride.driverId === identity.id  : ride.userId === identity.id;
      if (!allowed) {
        throw new WsException(
          'You are not part of this ride',
        );
      }

      await this.realtimeService.leaveRide(
        client,
        dto.rideId,
      );
      this.logger.log( `RIDE ROOM LEFT | socket=${client.id} | rideId=${dto.rideId} | type=${identity.type} | id=${identity.id}`,);
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
    @ConnectedSocket() client: Socket,
    @MessageBody(
      new ValidationPipe({
        transform: true,
      }),
    )
    dto: RejectRideDto,
  ) {
    try {
      const identity = this.getIdentity(client);
      if (identity.type !== 'driver') {
        throw new WsException(
          'Only drivers can reject rides',
        );
      }
      const offer = await this.ridesService.rejectOffer(
          dto.rideId,
          dto.offerId,
          identity.id,
        );
      this.logger.log(`RIDE OFFER REJECTED | driverId=${identity.id} | rideId=${dto.rideId} | offerId=${dto.offerId}`,);
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
    @ConnectedSocket() client: Socket,
    @MessageBody(
      new ValidationPipe({
        transform: true,
      }),
    )
    dto: DriverLocationDto,
  ) {
    try {
      const identity =this.getIdentity(client);
      if (identity.type !== 'driver') {
        throw new WsException(
          'Only drivers can send location',
        );
      }
      const ride =await this.ridesService.getRideForRealtime(
          dto.rideId,
        );

      if (ride.driverId !== identity.id) {
        throw new WsException(
          'Driver is not assigned to this ride',
        );
      }

      if (ride.status !== 'accepted' && ride.status !== 'driver_arriving' &&ride.status !== 'in_progress' ) {
        throw new WsException(
          'Ride is not active',
        );
      }

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

      return {
        success: true,
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

    if (  identity.type !== 'driver' &&  identity.type !== 'user' ) {
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


  
  private toWsException( error: unknown,
  ): WsException {
    if (   error instanceof WsException ) {
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
