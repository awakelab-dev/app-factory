import { Module } from '@nestjs/common';
import { FocusFlowController } from './focus-flow.controller';
import { FocusSessionsService } from './focus-flow-sessions.service';
import { FocusSettingsService } from './focus-flow-settings.service';
import { FocusStatsService } from './focus-flow-stats.service';
import { FocusTasksService } from './focus-flow-tasks.service';
import { FocusTimerStateService } from './focus-flow-timer-state.service';

/**
 * Temporizador Pomodoro personal (uso de cualquier autenticado, sin rol de
 * manifest nuevo — D-011, gate funcional decisión 1). PrismaService y
 * AuditService llegan por los módulos @Global (no se reimportan, mismo
 * patrón que moodle-insights/orientador-ia/gestor-proyectos).
 *
 * Este módulo todavía no está registrado en `AppModule`
 * (`apps/api/src/app.module.ts`): el paso de generación (docs/04, paso 4)
 * solo puede tocar esta carpeta — el cableado a `AppModule` (y el
 * `module.manifest.ts`/registro en `apps/web/.../modules/registry.ts`, ya
 * presentes en el lado web) queda para el paso de integración/PR review.
 */
@Module({
  controllers: [FocusFlowController],
  providers: [FocusSettingsService, FocusTasksService, FocusSessionsService, FocusStatsService, FocusTimerStateService]
})
export class FocusFlowModule {}
