import {ConnectedSocket, MessageBody, SubscribeMessage,WebSocketGateway, WebSocketServer,} from '@nestjs/websockets';
import { Injectable,} from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { DriverLocationService } from '../ride-matchingqueue/driver-location.service';

@WebSocketGateway({
  namespace: '/driver',
  cors: {
    origin: '*',
  },
})
@Injectable()
export class DriverGateway {
  @WebSocketServer()
  server!: Server;
  constructor(
    private readonly driverLocationService: DriverLocationService,
  ) {}

  @SubscribeMessage('driver.location')
  handleLocation(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    body: {
      lat: number;
      lng: number;
    },
  ): void {
    const driverId = socket.data.driverId;

    if (!driverId) {
      return;
    }

    this.driverLocationService.setLocation(
      driverId,
      body.lat,
      body.lng,
    );
  }

  handleDisconnect(
    socket: Socket,
  ): void {
    const driverId = socket.data.driverId;

    if (!driverId) {
      return;
    }

    this.driverLocationService.removeLocation(
      driverId,
    );
  }
}
