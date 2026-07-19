import { Module } from '@nestjs/common';
import { GestorPermissionsService } from './gestor-proyectos-permissions.service';
import { GestorProjectsService } from './gestor-proyectos-projects.service';
import { GestorReportsService } from './gestor-proyectos-reports.service';
import { GestorTasksService } from './gestor-proyectos-tasks.service';
import { GestorProyectosController } from './gestor-proyectos.controller';

/**
 * Tablero kanban de proyectos/sprints/tareas (uso interno de Awakelab, sin
 * rol de manifest nuevo — D-011). PrismaService y AuditService llegan por
 * los módulos @Global (no se reimportan, mismo patrón que moodle-insights/
 * orientador-ia). Este módulo todavía no está registrado en `AppModule`
 * (`apps/api/src/app.module.ts`): el paso de generación (docs/04, paso 4)
 * solo puede tocar esta carpeta — el cableado a `AppModule` (y el
 * `module.manifest.ts`/registro en `apps/web/.../modules/registry.ts`, ya
 * presentes en el lado web) queda para el paso de integración/PR review.
 */
@Module({
  controllers: [GestorProyectosController],
  providers: [GestorPermissionsService, GestorProjectsService, GestorTasksService, GestorReportsService]
})
export class GestorProyectosModule {}
