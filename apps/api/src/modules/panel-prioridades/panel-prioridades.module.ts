import { Module } from '@nestjs/common';
import { PanelPrioritiesController } from './panel-prioridades.controller';
import { PanelPrioritiesTasksService } from './panel-prioridades-tasks.service';
import { PanelPrioritiesScheduleService } from './panel-prioridades-schedule.service';
import { PanelPrioritiesTeamService } from './panel-prioridades-team.service';
import { PanelPrioritiesDelegationsService } from './panel-prioridades-delegations.service';
import { PanelPrioritiesKpisService } from './panel-prioridades-kpis.service';

/**
 * Panel de Prioridades (matriz de Eisenhower).
 * Módulo monouser con datos confidencial-personales (spec D-056).
 *
 * PrismaService y AuditService llegan por los módulos @Global (no se reimportan,
 * mismo patrón que orientador-ia, focus-flow, etc.).
 *
 * Rol nuevo: `panel_admin` declarado en `apps/web/.../panel-prioridades/module.manifest.ts`.
 * Los endpoints aceptan `@Roles('panel_admin', 'admin')`.
 *
 * Este módulo se descubre automáticamente por la existencia de `panel-prioridades.module.ts`
 * en `apps/api/src/modules/` — no requiere cableado manual en `app.module.ts`
 * (D-050: descubrimiento por carpeta, registrador automático en tiempo de compilación).
 */
@Module({
  controllers: [PanelPrioritiesController],
  providers: [
    PanelPrioritiesTasksService,
    PanelPrioritiesScheduleService,
    PanelPrioritiesTeamService,
    PanelPrioritiesDelegationsService,
    PanelPrioritiesKpisService
  ]
})
export class PanelPrioritiesModule {}
