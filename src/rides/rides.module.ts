import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';

import { Ride } from '../database/entities/ride.entity';
import { MatchingModule } from './matching/matching.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      Ride,
    ]),
    MatchingModule,
  ],

  controllers: [
    RidesController,
  ],

  providers: [
    RidesService,
  ],

  exports: [
    RidesService,
  ],
})
export class RidesModule {}
