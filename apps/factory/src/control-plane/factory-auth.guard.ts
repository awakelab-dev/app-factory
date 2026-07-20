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
import { ActorsService } from '../pipeline/actors.service';
import type { FactoryActorContext } from '../pipeline/types';
import { FACTORY_ADMIN_ROLES, IS_PUBLIC_KEY } from './auth.constants';

/**
 * Guard global del control plane. Desde D-036 acepta DOS credenciales en el
 * mismo header Bearer:
 *
 * - **JWT de plataforma** (emitido por apps/api, verificado con el mismo
 *   JWT_SECRET — D-030): exige rol `admin`, como siempre. Es como entra
 *   Leonardo por /factory.
 * - **PAT de la Fábrica** (prefijo `awkf_`, tabla factory_actors — D-036,
 *   auth interina hasta el SSO): lookup por hash SHA-256, rechazado si está
 *   revocado. Es como entra el conector MCP de Cowork (gerentes).
 *
 * En ambos casos deja en `request.actor` un FactoryActorContext {email, rol}
 * — la autorización FINA (scope por proyecto, gates por rol) vive en los
 * servicios del pipeline, no aquí: el guard solo autentica y normaliza.
 */
@Injectable()
export class FactoryAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly actors: ActorsService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthUser;
      actor?: FactoryActorContext;
    }>();
    const header = request.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) throw new UnauthorizedException('Falta el token Bearer');

    if (ActorsService.isPat(token)) {
      const actor = await this.actors.findActiveByToken(token);
      // Mismo 401 para "no existe" y "revocado": no filtrar cuál.
      if (!actor) throw new UnauthorizedException('PAT inválido o revocado');
      request.actor = actor;
      return true;
    }

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
    request.actor = { email: user.email, role: 'admin' };
    return true;
  }
}
