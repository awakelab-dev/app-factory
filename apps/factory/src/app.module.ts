import { Module } from '@nestjs/common';
import { PipelineModule } from './pipeline/pipeline.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Módulo raíz de la Fábrica (apps/factory, D-029). Fase 1 (paso 1 de D-026):
 * sin servidor HTTP todavía — se opera por CLI (src/cli.ts) vía
 * `NestFactory.createApplicationContext`. El dashboard/API HTTP es el paso 2
 * de D-026 (control plane): se añadirán controllers + `app.listen()` en este
 * módulo sin tocar PipelineModule, que ya expone toda la lógica como
 * servicios inyectables.
 */
@Module({
  imports: [PrismaModule, PipelineModule]
})
export class AppModule {}
