import { Module } from '@nestjs/common';
import { AnalysisRunnerService } from './analysis-runner.service';
import { GatesService } from './gates.service';
import { GenerationRunnerService } from './generation-runner.service';
import { ProjectsService } from './projects.service';

/**
 * Mecánica del pipeline (paso 1 de D-026, docs/04-integracion-cowork.md
 * pasos 2-6). El modelo de datos vive en prisma/schema.prisma; este módulo
 * agrupa los servicios que lo mueven de estado en estado. Se opera por CLI
 * (src/cli.ts) y, desde D-030, también por HTTP: el ControlPlaneModule
 * (../control-plane/) monta controllers de lectura + decisión de gates sobre
 * estos mismos servicios, sin modificarlos.
 */
@Module({
  providers: [ProjectsService, GatesService, AnalysisRunnerService, GenerationRunnerService],
  exports: [ProjectsService, GatesService, AnalysisRunnerService, GenerationRunnerService]
})
export class PipelineModule {}
