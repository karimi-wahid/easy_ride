import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

import { RidesService } from './rides.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { AuthUser } from '../shared/interface/auth-user.interface';

type AuthenticatedRequest = Request & {
  user: AuthUser;
};

@Controller('rides')
export class RidesController {
  constructor(
    private readonly ridesService: RidesService,
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
}
