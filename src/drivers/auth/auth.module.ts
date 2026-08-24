import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from '../auth/auth.service';

import { JwtStrategy } from '../../shared/strategies/jwt.strategy';
import { SharedModule } from '../../shared/shared.module';

import { DriversModule } from '../drivers.module';

import { Driver } from '../../database/entities/driver.entity';
import { DriverSession } from '../../database/entities/driver-session.entity';
import { DriverSecurityAction } from '../../database/entities/driver-security-action.entity';
import { DriverTwoFactor } from '../../database/entities/driver-two-factor.entity';

@Module({
  imports: [
    ConfigModule,
    DriversModule,
    PassportModule,
    SharedModule,

    MikroOrmModule.forFeature([
      Driver,
      DriverSession,
      DriverSecurityAction,
      DriverTwoFactor,
    ]),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService,
      ) => ({
        secret: configService.getOrThrow<string>(
          'JWT_ACCESS_SECRET',
        ),
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    JwtStrategy,
  ],
})
export class DriverAuthModule {}