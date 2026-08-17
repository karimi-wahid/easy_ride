import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';

import { RegisterDto } from './dto/register.dto';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyLoginDto } from './dto/verify-login.dto';
import { VerifyTwoFactorDto } from './dto/verify-2fa.dto';

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
  verifyLogin(
    @Body() dto: VerifyLoginDto,
  ) {
    return this.authService.verifyLogin(dto);
  }

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  enableTwoFactor(@Req() req: any) {
    return this.authService.enableTwoFactor(
      req.user.id,
    );
  }

  @Post('2fa/verify')
  verifyTwoFactor(
    @Body() dto: VerifyTwoFactorDto,
  ) {
    return this.authService.verifyTwoFactor(dto);
  }
}