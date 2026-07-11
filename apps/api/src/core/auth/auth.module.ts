import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { getJwtSecret, JWT_EXPIRES_IN } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

/**
 * Autenticación y autorización del core. Registra los dos guards globales
 * en orden: primero JwtAuthGuard (autentica y deja request.user), después
 * RolesGuard (autoriza contra @Roles con la regla canAccess de @awk/auth).
 */
@Module({
  imports: [
    JwtModule.register({
      secret: getJwtSecret(),
      signOptions: { expiresIn: JWT_EXPIRES_IN }
    })
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard }
  ]
})
export class AuthModule {}
