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

import { DriverAuthSession } from '../../database/entities/driver-auth-session.entity';
import { DriverSession } from 'src/database/entities/driver-session.entity';

@Injectable()
export class DriverJwtStrategy extends PassportStrategy(
  Strategy,
  'driver-jwt',
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
}) {
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

  if (session.expiresAt <= new Date()) {
    throw new UnauthorizedException(
      'Driver session has expired',
    );
  }

  const driver = session.driver;

  if (
    !driver ||
    driver.id !== payload.sub ||
    driver.phone !== payload.phone ||
    driver.deletedAt
  ) {
    throw new UnauthorizedException(
      'Driver session is invalid',
    );
  }

  return {
    id: driver.id,
    phone: driver.phone,
    sessionId: session.id,
  };
}
}