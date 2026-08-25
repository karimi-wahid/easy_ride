import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { JwtStrategy } from 'src/shared/strategies/jwt.strategy';

import { OtpService } from 'src/shared/otp.service';
import { OtpApiService } from 'src/shared/HttpService.service';
import { DriverJwtStrategy } from 'src/shared/strategies/driver-jwt.strategy';
import { DriverJwtAuthGuard } from 'src/shared/guards/driver-jwt-auth.guard';

@Module({
  imports: [
    HttpModule,
  ],

  controllers: [
    DriversController,
  ],

  providers: [
    DriversService,
    JwtStrategy,
    DriverJwtStrategy,
    DriverJwtAuthGuard,
    OtpService,
    OtpApiService,
  ],

  exports: [
    OtpService,
  ],
})
export class DriversModule {}