import { Module } from '@nestjs/common';
import { ActorsService } from './actors.service';
import { AnalysisJobsService } from './analysis-jobs.service';
import { AnalysisRunnerService } from './analysis-runner.service';
import { AnalysisWorkerService } from './analysis-worker.service';
import { ChangeRequestsService } from './change-requests.service';
import { GatesService } from './gates.service';
import { GenerationRunnerService } from './generation-runner.service';
import { ProjectsService } from './projects.service';
import { SpecExportService } from './spec-export.service';
import { SubmissionsService } from './submissions.service';

/**
 * Mecánica del pipeline (paso 1 de D-026, docs/04-integracion-cowork.md
 * pasos 2-6). El modelo de datos vive en prisma/schema.prisma; este módulo
 * agrupa los servicios que lo mueven de estado en estado. Se opera por CLI
 * (src/cli.ts) y, desde D-030, también por HTTP: el ControlPlaneModule
 * (../control-plane/) monta controllers de lectura + decisión de gates sobre
 * estos mismos servicios, sin modificarlos.
 *
 * Desde D-047 incluye la cola de análisis (`AnalysisJobsService`) y su worker
 * (`AnalysisWorkerService`). Los tres contextos comparten este módulo pero
 * usan piezas distintas: el HTTP solo ENCOLA (nunca ejecuta agentes — D-030
 * sigue en pie), el worker (src/worker.ts) solo CONSUME, y el CLI conserva los
 * comandos manuales como escotilla.
 */
@Module({
  providers: [
    ProjectsService,
    GatesService,
    AnalysisRunnerService,
    GenerationRunnerService,
    ChangeRequestsService,
    SubmissionsService,
    ActorsService,
    AnalysisJobsService,
    AnalysisWorkerService,
    SpecExportService
  ],
  exports: [
    ProjectsService,
    GatesService,
    AnalysisRunnerService,
    GenerationRunnerService,
    ChangeRequestsService,
    SubmissionsService,
    ActorsService,
    AnalysisJobsService,
    AnalysisWorkerService,
    SpecExportService
  ]
})
export class PipelineModule {}
