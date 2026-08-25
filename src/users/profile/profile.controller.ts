import {Body,Controller,Get, Patch,Post,Req,UseGuards,} from '@nestjs/common';
import { Request } from 'express';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profiel.dto';
import { VerifyPhoneChangeDto } from './dto/verify-phone-change.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}
@Controller('users/me/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
  ) {}
  @Get()
  async getProfile(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.profileService.getProfile(
      req.user.id,
    );
  }

  @Patch()
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(
      req.user.id,
      dto,
    );
  }
  
  @Post('phone/verify')
  async verifyPhoneChange(
    @Req() req: AuthenticatedRequest,
    @Body() dto: VerifyPhoneChangeDto,
  ) {
    return this.profileService.verifyPhoneChange(
      req.user.id,
      dto,
    );
  }
}