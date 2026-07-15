import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@awk/auth';

export type RequestUser = AuthUser;

/** El AuthUser que FactoryAuthGuard dejó en request.user (mismo patrón que apps/api). */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): RequestUser => {
  const request = context.switchToHttp().getRequest<{ user: RequestUser }>();
  return request.user;
});
