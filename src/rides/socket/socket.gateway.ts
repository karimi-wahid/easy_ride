import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RealtimeService } from './socket.service';

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
  private readonly logger = new Logger(
    RealtimeGateway.name,
  );

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.realtimeService.setServer(server);

    this.logger.log(
      'Ride realtime gateway initialized',
    );
  }

  handleConnection(client: Socket): void {
    this.logger.log(
      `Socket connected: ${client.id}`,
    );
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(
      `Socket disconnected: ${client.id}`,
    );
  }
}
