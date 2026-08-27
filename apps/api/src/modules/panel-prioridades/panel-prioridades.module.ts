import { Module } from '@nestjs/common';
import { PanelPrioridadesController } from './panel-prioridades.controller';
import { PanelPrioridadesService } from './panel-prioridades.service';

/**
 * Panel de Prioridades (spec docs/pipeline/panel-prioridades/):
 * gestión personal de tareas basada en la matriz de Eisenhower,
 * con bloques de tiempo semanal, delegaciones e indicadores automáticos.
 *
 * PrismaService y AuditService llegan por los módulos @Global
 * (no se reimportan, mismo patrón que otros módulos generados).
 *
 * Este módulo TODAVÍA no está registrado en `AppModule`
 * (`apps/api/src/app.module.ts`): el paso de generación (docs/04, paso 4)
 * solo puede tocar esta carpeta — el cableado a `AppModule` y el registro
 * del manifest en `apps/web/.../modules/registry.ts` quedan para el paso
 * de integración/PR review (incremento D, fase D1).
 *
 * El rol `panel_admin` se declara en `module.manifest.ts` del frontend
 * y se siembra automáticamente en el startup (D-050) desde los manifests
 * registrados, sin necesidad de SQL a mano.
 */
@Module({
  controllers: [PanelPrioridadesController],
  providers: [PanelPrioridadesService]
})
export class PanelPrioridadesModule {}
