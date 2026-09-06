import { IsEnum } from 'class-validator';

import { DriverStatus } from 'src/shared/types/driver-status.enum';

export class UpdateDriverStatusDto {
  @IsEnum(DriverStatus, {
    message: 'status must be a valid driver status',
  })
  status: DriverStatus;
}
