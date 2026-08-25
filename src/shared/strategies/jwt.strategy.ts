import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
} from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from '@mikro-orm/postgresql';

import { User } from '../../database/entities/user.entity';
import { UserSession } from '../../database/entities/user-session.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
) {
  constructor(
    private readonly configService: ConfigService,
    private readonly em: EntityManager,
  ) {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey:
        configService.getOrThrow<string>(
          'JWT_ACCESS_SECRET',
        ),
    });
  }

  async validate(payload: {
    sub: string;
    phone: string;
    sid: string;
  }) 
  {
    if (
      !payload.sub ||
      !payload.phone ||
      !payload.sid
    ) {
      throw new UnauthorizedException(
        'Invalid access token',
      );
    }

    const session = await this.em.findOne(
      UserSession,
      {
        id: payload.sid,
        revokedAt: null,
      },
      {
        populate: ['user'],
      },
    );

    if (!session) {
      throw new UnauthorizedException(
        'Session is invalid or revoked 1',
      );
    }

    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Session has expired',
      );
    }

    const user = session.user;

    if (
      !user ||
      user.id !== payload.sub ||
      user.phone !== payload.phone ||
      user.deletedAt
    ) {
      throw new UnauthorizedException(
        'User session is invalid',
      );
    }

    return {
      id: user.id,
      phone: user.phone,
      sessionId: session.id,
    };
  }
}