import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UsersModule } from './users/users.module';
import { AuthModule } from './users/auth/auth.module';
import { AttachmentModule } from './attachment/attachment.module';
import { DriversModule } from './drivers/drivers.module';
import { DriverAuthModule } from './drivers/auth/auth.module';
import mikroOrmConfig from '../mikro-orm.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MikroOrmModule.forRoot(mikroOrmConfig),
    UsersModule,
    AuthModule,
    AttachmentModule,
    DriversModule,
    DriverAuthModule
  ],
})
export class AppModule {}