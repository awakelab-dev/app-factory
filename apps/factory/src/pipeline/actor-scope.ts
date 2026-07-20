import { ForbiddenException } from '@nestjs/common';
import type { FactoryActorContext } from './types';

/**
 * Scope por rol (D-036): un `gerente` solo ve/opera SUS proyectos —
 * `Project.requestedBy` = email del actor del PAT. `admin` (o sin actor:
 * CLI operado por Leonardo) ve todo. Helper compartido por servicios,
 * controllers y tools MCP para que la regla viva en un solo sitio.
 */
export function assertProjectVisibleToActor(
  project: { id: string; requestedBy: string },
  actor?: FactoryActorContext
): void {
  if (actor?.role === 'gerente' && project.requestedBy !== actor.email) {
    throw new ForbiddenException(
      `El proyecto ${project.id} no pertenece a ${actor.email} — un gerente solo ve sus propios proyectos.`
    );
  }
}
