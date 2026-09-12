import { Injectable, UnauthorizedException,} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/postgresql';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { DriverSession } from '../database/entities/driver-session.entity';
import { Driver } from '../database/entities/driver.entity';
import { UserSession } from '../database/entities/user-session.entity';
import { User } from '../database/entities/user.entity';



type AccessTokenPayload = {
  sub: string;
  phone: string;
  sid: string;
};

type SocketIdentity =
  | {
      type: 'driver';
      id: string;
    }
  | {
      type: 'user';
      id: string;
    };


@Injectable()
export class SocketAuthMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly em: EntityManager,
    private readonly jwtService: JwtService,
  ) {}


  async authenticate(
    client: Socket,
    next: (err?: Error) => void,
  ): Promise<void> {
    try {
      const token = client.handshake.auth?.token;

      if (!token) {
        throw new UnauthorizedException(
          'Socket token missing',
        );
      }

      const secret = this.configService.getOrThrow<string>(  'JWT_ACCESS_SECRET',);

      const payload =  await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
          {
            secret,
          },
        );


      if (!payload.sub ||!payload.phone ||!payload.sid ) {
        throw new UnauthorizedException(
          'Invalid access token',
        );
      }

      const em = this.em.fork();

      const driverSession = await em.findOne(   DriverSession,
          {
            id: payload.sid,
            revokedAt: null,
          },
          {
            populate: ['driver'],
          },
        );


      if (driverSession) {
        if (
          driverSession.expiresAt <= new Date()
        ) {
          throw new UnauthorizedException(
            'Driver session has expired',
          );
        }


        const driver = driverSession.driver;

        if (!driver ||driver.id !== payload.sub ||driver.phone !== payload.phone ||driver.deletedAt ) {
          throw new UnauthorizedException(
            'Driver session is invalid',
          );
        }

        const identity: SocketIdentity = {
          type: 'driver',
          id: driver.id,
        };

        client.data.identity = identity;
        next();
        return;
      }

    
      const userSession = await em.findOne(
          UserSession,
          {
            id: payload.sid,
            revokedAt: null,
          },
          {
            populate: ['user'],
          },
        );


      if (userSession) {
        if (
          userSession.expiresAt <= new Date()
        ) {
          throw new UnauthorizedException(
            'User session has expired',
          );
        }

        const user =   userSession.user;

        if (!user ||user.id !== payload.sub ||user.phone !== payload.phone ||user.deletedAt) {
          throw new UnauthorizedException(
            'User session is invalid',
          );
        }

        const identity: SocketIdentity = {
          type: 'user',
          id: user.id,
        };

        client.data.identity = identity;
        next();
        return;
      }

  
      throw new UnauthorizedException(
        'Socket session is invalid or revoked',
      );
      
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Socket authentication failed';

      next(
        new UnauthorizedException(message),
      );
    }
  }
}
