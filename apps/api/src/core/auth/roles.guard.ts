import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser, canAccess } from '@awk/auth';
import { ROLES_KEY } from './auth.constants';

/**
 * Guard global de autorización (corre después de JwtAuthGuard): aplica la
 * misma regla canAccess que usa el shell web para filtrar menú y rutas.
 * Sin @Roles() no exige nada más que estar autenticado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    // Sin user aquí solo puede pasar en endpoints @Public con @Roles (combinación sin sentido).
    if (!user || !canAccess(user, required)) {
      throw new ForbiddenException('No tienes permisos para esta operación');
    }
    return true;
  }
}
