import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AuthUser } from '@awk/auth';
import { IS_PUBLIC_KEY, ROLES_KEY } from './auth.constants';

/** Marca un handler/controller como accesible sin JWT. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe un handler/controller a usuarios con alguno de estos roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** Inyecta el AuthUser que dejó JwtAuthGuard en la request. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
  return request.user;
});
