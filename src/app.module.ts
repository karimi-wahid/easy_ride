import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UsersModule } from './users/users.module';
import { OtpModule } from './otp/otp.module';
import { AuthModule } from './auth/auth.module';

import mikroOrmConfig from '../mikro-orm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MikroOrmModule.forRoot(mikroOrmConfig),

    UsersModule,

    OtpModule,

    AuthModule,
  ],
})
export class AppModule {}
