import {Body,Controller, Get, Post,Req,UseGuards,} from '@nestjs/common';
import { RidesService } from './rides.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { AcceptRideDto } from '../socket/dto/accept-ride.dto';
import type { AuthenticatedRequest } from '../shared/types/authenticated-request';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';


@Controller('rides')
@UseGuards(JwtAuthGuard)
export class RidesController {
  constructor(
    private readonly ridesService: RidesService,
  ) {}


  @Post()
  async createRide(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateRideDto,
  ) {
    return this.ridesService.createRide(
      req.user.id,
      dto,
    );
  }


  @Get('available')
  async getAvailableRides() {
    return this.ridesService.getAvailableRides();
  }

  
  @Post('offers/accept')
  async acceptRideOffer(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AcceptRideDto,
  ) {
    return this.ridesService.acceptRideOffer(
      req.user.id,
      dto,
    );
  }
}
