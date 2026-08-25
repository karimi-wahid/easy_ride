import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';

import { RefreshTokenDto } from '../../drivers/auth/dto/refresh-token.dto';
import { RegisterDto } from '../../drivers/auth/dto/register.dto';
import { VerifyRegistrationDto } from '../../drivers/auth/dto/verify-registration.dto';
import { LoginDto } from '../../drivers/auth/dto/login.dto';
import { VerifyLoginDto } from '../../drivers/auth/dto/verify-login.dto';
import { VerifyTwoFactorDto } from '../../drivers/auth/dto/verify-2fa.dto';
import { VerifyTwoFactorSetupDto } from '../../drivers/auth/dto/verify-2fa-setup.dto';
import { DriverJwtAuthGuard } from 'src/shared/guards/driver-jwt-auth.guard';

@Controller('auth/driver')
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
  @UseGuards(DriverJwtAuthGuard)
  me(@Req() req: any) {
    return this.authService.getMe(
      req.driver.id,
      req.driver.sessionId,
    );
  }

  @Post('logout')
  @UseGuards(DriverJwtAuthGuard)
  logout(@Req() req: any) {
    return this.authService.logout(
      req.driver.id,
      req.driver.sessionId,
    );
  }

  @Post('2fa/enable')
  @UseGuards(DriverJwtAuthGuard)
  enableTwoFactor(@Req() req: any) {
    return this.authService.enableTwoFactor(
      req.user.id,
    );
  }

  @Post('2fa/enable/verify')
  @UseGuards(DriverJwtAuthGuard)
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