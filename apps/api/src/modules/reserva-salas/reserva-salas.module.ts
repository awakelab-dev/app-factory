import { Module } from '@nestjs/common';
import { ReservasService } from './reserva-salas-reservas.service';
import { ReservaSalasPermissionsService } from './reserva-salas-permissions.service';
import { SalasService } from './reserva-salas-salas.service';
import { ReservaSalasController } from './reserva-salas.controller';

/**
 * Reserva de Salas de reunión (spec docs/pipeline/reserva-salas/):
 * reemplaza la hoja de cálculo compartida y los avisos por chat del
 * prototipo. PrismaService y AuditService llegan por los módulos @Global
 * (no se reimportan, mismo patrón que moodle-insights/orientador-ia/
 * gestor-proyectos/focus-flow/incidencias-aula). Este módulo TODAVÍA no está
 * registrado en `AppModule` (`apps/api/src/app.module.ts`): el paso de
 * generación (docs/04, paso 4) solo puede tocar esta carpeta — el cableado a
 * `AppModule` (y el registro del manifest en
 * `apps/web/.../modules/registry.ts`, tampoco tocado en este paso) queda
 * para el paso de integración/PR review (mismo criterio documentado en
 * `incidencias-aula.module.ts`).
 */
@Module({
  controllers: [ReservaSalasController],
  providers: [ReservaSalasPermissionsService, SalasService, ReservasService]
})
export class ReservaSalasModule {}
