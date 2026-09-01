import { Module } from '@nestjs/common';

import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { RideMatchingService } from './matching_queue/rides-matching.service';
import { DriverLocationService } from './matching_queue/driver-location.service';
import { RideRequestService } from './ride-request.service';


@Module({
  controllers: [
    RidesController,
  ],
  providers: [
    RidesService,
    RideMatchingService,
    DriverLocationService,
    RideRequestService,
  ],
  exports: [
    DriverLocationService,
  ],
})
export class RidesModule {}
