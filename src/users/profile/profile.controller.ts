import { Body,Controller,Get,  Patch, Post, Req,UseGuards,} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profiel.dto';
import { VerifyPhoneChangeDto } from './dto/verify-phone-change.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import type { UserRequest } from '../../shared/types/user-request';

@Controller('users/me/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
  ) {}

  @Get()
  async getProfile(@Req() req: UserRequest) {
    return this.profileService.getProfile(req.user.id);
  }

  @Patch()
  async updateProfile(
    @Req() req: UserRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(
      req.user.id,
      dto,
    );
  }

  @Post('phone/verify')
  async verifyPhoneChange(
    @Req() req: UserRequest,
    @Body() dto: VerifyPhoneChangeDto,
  ) {
    return this.profileService.verifyPhoneChange(
      req.user.id,
      dto,
    );
  }
}