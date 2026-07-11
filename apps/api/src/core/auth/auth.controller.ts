import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { AuthUser } from '@awk/auth';
import { DevLoginRequest, devLoginRequestSchema, DevLoginResponse } from '@awk/types';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Public } from './auth.decorators';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(200)
  @Post('dev-login')
  devLogin(
    @Body(new ZodValidationPipe(devLoginRequestSchema)) body: DevLoginRequest
  ): Promise<DevLoginResponse> {
    return this.authService.devLogin(body.email);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): AuthUser {
    return user;
  }
}
