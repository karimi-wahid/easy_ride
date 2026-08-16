import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';

@Module({
  imports: [HttpModule],
  providers: [OtpService],
  exports: [OtpService],
  controllers: [OtpController],
})
export class OtpModule {}
