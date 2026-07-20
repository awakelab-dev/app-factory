import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  factoryChangeRequestRequestSchema,
  type FactoryChangeRequestRequest,
  type FactoryChangeRequestResponse
} from '@awk/types';
import { ChangeRequestsService } from '../pipeline/change-requests.service';
import type { FactoryActorContext } from '../pipeline/types';
import { CurrentActor } from './current-actor.decorator';
import { toChangeRequestDto } from './mappers';
import { ZodValidationPipe } from './zod-validation.pipe';

/**
 * Alta de peticiones de cambio (request_change → POST /change-requests,
 * D-036) sobre ChangeRequestsService (D-034) tal cual. Solo REGISTRA la
 * petición: el análisis de cambio sigue lanzado por dev vía CLI
 * `request-change`/analyze (D-030 — sin cola, sin runs largos por HTTP).
 * Un gerente solo pide cambios sobre SUS proyectos (scope en el servicio);
 * `requestedBy` sale del actor autenticado.
 */
@Controller('change-requests')
export class ChangeRequestsController {
  constructor(private readonly changeRequests: ChangeRequestsService) {}

  @Post()
  @HttpCode(201)
  async create(
    @Body(new ZodValidationPipe(factoryChangeRequestRequestSchema)) body: FactoryChangeRequestRequest,
    @CurrentActor() actor: FactoryActorContext
  ): Promise<FactoryChangeRequestResponse> {
    const changeRequest = await this.changeRequests.create({
      projectId: body.projectId,
      requestText: body.requestText,
      requestedBy: actor.email,
      actor
    });
    return toChangeRequestDto(changeRequest);
  }
}
