import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { User } from '../../database/entities/user.entity';
import { UserSecurityAction } from '../../database/entities/user-security-action.entity';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [
    SharedModule,
    MikroOrmModule.forFeature([
      User,
      UserSecurityAction,
    ]),
  ],
  controllers: [
    ProfileController,
  ],
  providers: [
    ProfileService,
  ],
})
export class ProfileModule {}