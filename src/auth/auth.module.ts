import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { OtpModule } from '../otp/otp.module';
import { User } from 'src/entities/users/user.entity';

@Module({
  imports: [MikroOrmModule.forFeature([User]), OtpModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
