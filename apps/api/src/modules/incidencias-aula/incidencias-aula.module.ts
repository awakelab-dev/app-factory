import { Module } from '@nestjs/common';
import { IncidenciasAulasService } from './incidencias-aula-aulas.service';
import { IncidenciasService } from './incidencias-aula-incidencias.service';
import { IncidenciasPermissionsService } from './incidencias-aula-permissions.service';
import { IncidenciasResumenService } from './incidencias-aula-resumen.service';
import { IncidenciasAulaController } from './incidencias-aula.controller';

/**
 * Registro de incidencias de aula de un centro de FP (uso interno de
 * Awakelab, gate funcional decisión 1). PrismaService y AuditService llegan
 * por los módulos @Global (no se reimportan, mismo patrón que
 * moodle-insights/orientador-ia/gestor-proyectos). Este módulo TODAVÍA no
 * está registrado en `AppModule` (`apps/api/src/app.module.ts`): el paso de
 * generación (docs/04, paso 4) solo puede tocar esta carpeta — el cableado a
 * `AppModule` (y el `module.manifest.ts`/registro en
 * `apps/web/.../modules/registry.ts`, ya presentes en el lado web) queda
 * para el paso de integración/PR review (gate técnico, nota "SIN WIRING").
 */
@Module({
  controllers: [IncidenciasAulaController],
  providers: [
    IncidenciasPermissionsService,
    IncidenciasAulasService,
    IncidenciasService,
    IncidenciasResumenService
  ]
})
export class IncidenciasAulaModule {}
