import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { OtpService } from './otp.service';
import { OtpApiService } from '../shared/HttpService.service';

@Module({
  imports: [
    HttpModule,
  ],

  providers: [
    OtpService,
    OtpApiService,
  ],

  exports: [
    OtpService,
  ],
})
export class OtpModule {}