import {Injectable, UnauthorizedException,} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/postgresql';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { DriverSession } from '../../database/entities/driver-session.entity';
import { Driver } from '../../database/entities/driver.entity';

@Injectable()
export class SocketAuthMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly em: EntityManager,
    private readonly jwtService: JwtService,
  ) {}

  async authenticate( client: Socket, next: (err?: Error) => void,
  ): Promise<void> {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        throw new UnauthorizedException(
          'Socket token missing',
        );
      }
      const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET',);
      const payload =await this.jwtService.verifyAsync<{sub: string;phone:string;sid:string;}>(token, {
          secret,
        });

      if (!payload.sub ||!payload.phone ||!payload.sid
      ) {
        throw new UnauthorizedException(
          'Invalid access token',
        );
      }

      const em = this.em.fork();
      const session =  await em.findOne(
          DriverSession,
          {
            id: payload.sid,
            revokedAt: null,
          },
          {
            populate: ['driver'],
          },
        );

      if (!session) {
        throw new UnauthorizedException(
          'Driver session is invalid or revoked',
        );
      }

      if (
        session.expiresAt <= new Date()
      ) {
        throw new UnauthorizedException(
          'Driver session has expired',
        );
      }

      const driver = session.driver;

      if ( !driver || driver.id !== payload.sub ||driver.phone !== payload.phone ||driver.deletedAt ) {
        throw new UnauthorizedException(
          'Driver session is invalid',
        );
      }

      client.data.identity = {
        type: 'driver',
        id: driver.id,
      };

      next();
    } catch (error) {
      const message = error instanceof Error
         ? error.message
          : 'Socket authentication failed';
      next(
        new UnauthorizedException(message),
      );
    }
  }
}
