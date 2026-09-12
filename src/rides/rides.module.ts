import { forwardRef, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { Ride } from '../database/entities/ride.entity';
import { MatchingModule } from '../shared/matching/matching.module';
import { RealtimeModule } from '../socket/socket.module';
import { RoutingModule } from '../routing/routing.module';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      Ride,
    ]),

    MatchingModule,

    forwardRef(() =>
      RealtimeModule,
    ),

    RoutingModule,
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
