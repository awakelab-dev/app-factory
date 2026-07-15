import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthUser, JwtPayload, canAccess, payloadToUser } from '@awk/auth';
import { FACTORY_ADMIN_ROLES, IS_PUBLIC_KEY } from './auth.constants';

/**
 * Guard global del control plane: valida el JWT de PLATAFORMA (emitido por
 * apps/api, verificado aquí con el mismo JWT_SECRET — D-030) y exige rol
 * `admin` para toda la superficie HTTP salvo el healthcheck (@Public).
 * A diferencia del par JwtAuthGuard+RolesGuard de apps/api, aquí un solo
 * guard hace ambas cosas: no hay endpoints con roles distintos que
 * justifiquen separar la autorización por decorador.
 */
@Injectable()
export class FactoryAuthGuard implements CanActivate {
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

    let user: AuthUser;
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      user = payloadToUser(payload);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    if (!canAccess(user, FACTORY_ADMIN_ROLES)) {
      throw new ForbiddenException('El control plane de la Fábrica requiere rol admin');
    }

    request.user = user;
    return true;
  }
}
