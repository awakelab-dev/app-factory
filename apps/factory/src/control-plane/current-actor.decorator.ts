import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FactoryActorContext } from '../pipeline/types';

/**
 * El FactoryActorContext que FactoryAuthGuard dejó en request.actor (D-036):
 * {email, rol} normalizado venga de PAT (gerente/admin) o de JWT de
 * plataforma (siempre admin). Es lo que los controllers pasan a los
 * servicios del pipeline para el scope por rol.
 */
export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext): FactoryActorContext => {
  const request = context.switchToHttp().getRequest<{ actor: FactoryActorContext }>();
  return request.actor;
});
