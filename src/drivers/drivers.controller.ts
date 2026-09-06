import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { DriversService } from './drivers.service';

import { UpdateDriverProfileDto } from './profile/dto/updateDriverProfileDto';
import { RequestPhoneOtpDto } from './profile/dto/RequestPhoneOtpDto';
import { VerifyPhoneChangeDto } from './profile/dto/VerifyPhoneChangeDto';
import { UpdateDriverLocationDto } from './dto/update-driver-location.dto';

import type { AuthenticatedRequest } from 'src/shared/types/authenticated-request';
import { DriverJwtAuthGuard } from 'src/shared/guards/driver-jwt-auth.guard';
import { DriverStatus } from 'src/shared/types/driver-status.enum';

@Controller('drivers')
export class DriversController {
  constructor(
    private readonly driverService: DriversService,
  ) {}

  @Get('me')
  @UseGuards(DriverJwtAuthGuard)
  async getMe(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.driverService.getMe(
      req.user.id,
    );
  }

  @Patch('profile')
  @UseGuards(DriverJwtAuthGuard)
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateDriverProfileDto,
  ) {
    return this.driverService.updateProfile(
      req.user.id,
      dto,
    );
  }

  @Post('profile/phone/request-otp')
  @UseGuards(DriverJwtAuthGuard)
  async requestPhoneOtp(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RequestPhoneOtpDto,
  ) {
    return this.driverService.requestPhoneChange(
      req.user.id,
      dto.phone,
    );
  }

  @Post('profile/phone/verify')
  @UseGuards(DriverJwtAuthGuard)
  async verifyPhoneChange(
    @Req() req: AuthenticatedRequest,
    @Body() dto: VerifyPhoneChangeDto,
  ) {
    return this.driverService.verifyPhoneChange(
      req.user.id,
      dto,
    );
  }

  @Patch('location')
  @UseGuards(DriverJwtAuthGuard)
  async updateLocation(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateDriverLocationDto,
  ) {
    await this.driverService.updateLocation(
      req.user.id,
      dto,
    );

    return {
      success: true,
      message: 'Driver location updated',
    };
  }

  @Patch('status')
  @UseGuards(DriverJwtAuthGuard)
  async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Body('status') status: DriverStatus,
  ) {
    return this.driverService.updateStatus(
      req.user.id,
      status,
    );
  }
}
