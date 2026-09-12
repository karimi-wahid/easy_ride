import { Module } from '@nestjs/common';
import { OsrmClient } from './osrm.client';
import { RoutingService } from './routing.service';

@Module({
  providers: [
    OsrmClient,
    RoutingService,
  ],
  exports: [
    RoutingService,
  ],
})
export class RoutingModule {}
