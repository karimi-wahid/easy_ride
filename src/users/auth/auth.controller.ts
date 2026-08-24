import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';

import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';

import { RefreshTokenDto } from '../../users/auth/dto/refresh-token.dto';
import { RegisterDto } from '../../users/auth/dto/register.dto';
import { VerifyRegistrationDto } from '../../users/auth/dto/verify-registration.dto';
import { LoginDto } from '../../users/auth/dto/login.dto';
import { VerifyLoginDto } from '../../users/auth/dto/verify-login.dto';
import { VerifyTwoFactorDto } from '../../users/auth/dto/verify-2fa.dto';
import { VerifyTwoFactorSetupDto } from '../../users/auth/dto/verify-2fa-setup.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register/verify')
  verifyRegistration(
    @Body() dto: VerifyRegistrationDto,
  ) {
    return this.authService.verifyRegistration(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('login/verify')
  verifyLogin(@Body() dto: VerifyLoginDto) {
    return this.authService.verifyLogin(dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    return this.authService.getMe(
      req.user.id,
      req.user.sessionId,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() req: any) {
    return this.authService.logout(
      req.user.id,
      req.user.sessionId,
    );
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  enableTwoFactor(@Req() req: any) {
    return this.authService.enableTwoFactor(
      req.user.id,
    );
  }

  @Post('2fa/enable/verify')
  @UseGuards(JwtAuthGuard)
  verifyTwoFactorSetup(
    @Req() req: any,
    @Body() dto: VerifyTwoFactorSetupDto,
  ) {
    return this.authService.verifyTwoFactorSetup(
      req.user.id,
      dto,
    );
  }

  @Post('2fa/verify')
  verifyTwoFactor(
    @Body() dto: VerifyTwoFactorDto,
  ) {
    return this.authService.verifyTwoFactor(dto);
  }
}