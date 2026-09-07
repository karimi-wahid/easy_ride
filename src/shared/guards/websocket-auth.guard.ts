import {CanActivate,ExecutionContext, Injectable,  UnauthorizedException,} from '@nestjs/common';
import { Socket } from 'socket.io';
import { SocketData, SocketUserRole } from '../types/socket-data.type';
 
@Injectable()
export class WebsocketAuthGuard implements CanActivate {
  constructor(
    private readonly authService: any,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();

    const token = this.extractToken(client);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const payload = await this.authService.verifyAccessToken(token);

    if (!payload?.userId || !payload?.role) {
      throw new UnauthorizedException('Invalid access token');
    }

    const socketData: SocketData = {
      userId: String(payload.userId),
      role: payload.role as SocketUserRole,
    };

    client.data = socketData;

    return true;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;

    if (typeof authToken === 'string' && authToken.length > 0) {
      return this.removeBearerPrefix(authToken);
    }

    const authorization =
      client.handshake.headers.authorization;


    if ( typeof authorization === 'string' &&authorization.length > 0) {
      return this.removeBearerPrefix(authorization);
    }
    return null;
    }


  private removeBearerPrefix(token: string): string {
    if (token.startsWith('Bearer ')) {
      return token.substring(7);
    }

    return token;
  }
}
