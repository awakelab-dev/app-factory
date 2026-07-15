import { Module } from '@nestjs/common';
import { AnalysisRunnerService } from './analysis-runner.service';
import { GatesService } from './gates.service';
import { GenerationRunnerService } from './generation-runner.service';
import { ProjectsService } from './projects.service';

/**
 * Mecánica del pipeline (paso 1 de D-026, docs/04-integracion-cowork.md
 * pasos 2-6). El modelo de datos vive en prisma/schema.prisma; este módulo
 * agrupa los servicios que lo mueven de estado en estado. Sin controllers
 * todavía — se opera por CLI (src/cli.ts); el HTTP llega en el paso 2 de
 * D-026 (control plane), como un módulo de controllers nuevo sobre estos
 * mismos servicios.
 */
@Module({
  providers: [ProjectsService, GatesService, AnalysisRunnerService, GenerationRunnerService],
  exports: [ProjectsService, GatesService, AnalysisRunnerService, GenerationRunnerService]
})
export class PipelineModule {}
