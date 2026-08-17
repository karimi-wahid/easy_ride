import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { JwtStrategy } from '../shared/strategies/jwt.strategy';
import { SharedModule } from '../shared/shared.module';

import { UsersModule } from '../users/users.module';

import { User } from '../database/entities/user.entity';
import { UserSession } from '../database/entities/user-session.entity';
import { UserSecurityAction } from '../database/entities/user-security-action.entity';
import { UserTwoFactor } from '../database/entities/user-two-factor.entity';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    PassportModule,
    SharedModule,

    MikroOrmModule.forFeature([
      User,
      UserSession,
      UserSecurityAction,
      UserTwoFactor,
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
export class AuthModule {}