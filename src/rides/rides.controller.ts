import {
  Body,
  Controller,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

import { RidesService } from './rides.service';
import { RideRequestService } from './ride-request.service';

import { CreateRideDto } from './dto/create-ride.dto';
import { AuthUser } from '../shared/interface/auth-user.interface';

type AuthenticatedRequest = Request & {
  user: AuthUser;
};

@Controller('rides')
export class RidesController {
  constructor(
    private readonly ridesService: RidesService,
    private readonly rideRequestService: RideRequestService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createRide(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateRideDto,
  ) {
    return this.ridesService.createRide(
      req.user.id,
      dto,
    );
  }

  @Post(':requestId/accept')
  @UseGuards(AuthGuard('jwt'))
  async acceptRide(
    @Req() req: AuthenticatedRequest,
    @Param('requestId') requestId: string,
  ) {
    return this.rideRequestService.acceptRequest(
      requestId,
      req.user.id,
    );
  }

  @Post(':requestId/reject')
  @UseGuards(AuthGuard('jwt'))
  async rejectRide(
    @Req() req: AuthenticatedRequest,
    @Param('requestId') requestId: string,
  ) {
    return this.rideRequestService.rejectRequest(
      requestId,
      req.user.id,
    );
  }
}
