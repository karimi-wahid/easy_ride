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

import type { AuthenticatedRequest } from 'src/shared/types/authenticated-request';
import { DriverJwtAuthGuard } from 'src/shared/guards/driver-jwt-auth.guard';

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
}