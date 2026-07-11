import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthUser, JwtPayload, payloadToUser } from '@awk/auth';
import { IS_PUBLIC_KEY } from './auth.constants';

/**
 * Guard global de autenticación: todo endpoint exige Bearer JWT salvo que
 * esté marcado con @Public(). Deja el AuthUser en request.user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>();
    const header = request.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) throw new UnauthorizedException('Falta el token Bearer');

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      request.user = payloadToUser(payload);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    return true;
  }
}
