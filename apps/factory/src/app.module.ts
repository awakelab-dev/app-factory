import { Module } from '@nestjs/common';
import { ControlPlaneModule } from './control-plane/control-plane.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Módulo raíz del servidor HTTP de la Fábrica (control plane, D-030 — paso 2
 * de D-026): PipelineModule (D-029, lógica del pipeline) + ControlPlaneModule
 * (controllers de lectura/gates con guard JWT de plataforma). El CLI
 * (src/cli.ts) NO usa este módulo: usa CliModule (cli.module.ts), sin HTTP ni
 * JWT — los runners de análisis/generación se siguen operando solo por CLI.
 */
@Module({
  imports: [PrismaModule, PipelineModule, ControlPlaneModule]
})
export class AppModule {}
