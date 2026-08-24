import { Module } from '@nestjs/common';
import { MesaAyudaController } from './mesa-ayuda.controller';
import { MesaAyudaService } from './mesa-ayuda.service';

/**
 * Mesa de Ayuda Awakelab (spec docs/pipeline/mesa-ayuda/):
 * gestión de tickets de soporte técnico con SLA, asignación de agentes,
 * base de conocimiento (KB) y respuestas preformuladas.
 *
 * PrismaService y AuditService llegan por los módulos @Global
 * (no se reimportan, mismo patrón que otros módulos generados).
 *
 * Este módulo TODAVÍA no está registrado en `AppModule`
 * (`apps/api/src/app.module.ts`): el paso de generación (docs/04, paso 4)
 * solo puede tocar esta carpeta — el cableado a `AppModule` y el registro
 * del manifest en `apps/web/.../modules/registry.ts` quedan para el paso
 * de integración/PR review.
 */
@Module({
  controllers: [MesaAyudaController],
  providers: [MesaAyudaService]
})
export class MesaAyudaModule {}
