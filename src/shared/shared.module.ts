import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { User } from '../database/entities/user.entity';
import { ProfileHelperService } from './profile-helper.service';
import { OtpService } from './otp.service';
import { OtpApiService } from './HttpService.service';

@Module({
  imports: [
    HttpModule,

    MikroOrmModule.forFeature([
      User,
    ]),
  ],
  providers: [
    OtpService,
    OtpApiService,
    ProfileHelperService,
  ],
  exports: [
    OtpService,
    ProfileHelperService,
  ],
})
export class SharedModule {}