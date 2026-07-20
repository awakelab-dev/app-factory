import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  factorySubmissionRequestSchema,
  type FactorySubmissionRequest,
  type FactorySubmissionResponse
} from '@awk/types';
import { SubmissionsService } from '../pipeline/submissions.service';
import type { FactoryActorContext, ProjectStatus } from '../pipeline/types';
import { CurrentActor } from './current-actor.decorator';
import { ZodValidationPipe } from './zod-validation.pipe';

/**
 * Intake de prototipos desde Cowork (submit_prototype → POST /submissions,
 * D-036): valida el prototype.manifest.json con el MISMO schema Zod que usa
 * el conector (@awk/types) y deja el proyecto en `received` — el análisis NO
 * se dispara aquí (incremento A: control de costo + D-030, sin cola de
 * trabajos). `submittedBy` sale del actor autenticado, nunca del body.
 */
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post()
  @HttpCode(201)
  async create(
    @Body(new ZodValidationPipe(factorySubmissionRequestSchema)) body: FactorySubmissionRequest,
    @CurrentActor() actor: FactoryActorContext
  ): Promise<FactorySubmissionResponse> {
    const { project, submission } = await this.submissions.create({
      moduleSlug: body.moduleSlug,
      displayName: body.displayName,
      sourceHtml: body.sourceHtml,
      manifest: body.manifest,
      submittedBy: actor.email
    });
    return {
      projectId: project.id,
      submissionId: submission.id,
      moduleSlug: project.moduleSlug,
      status: project.status as ProjectStatus,
      message:
        'Prototipo recibido — pendiente de análisis. La Fábrica correrá el análisis y abrirá los gates; consulta el avance con get_project_status.'
    };
  }
}
