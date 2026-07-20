import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import {
  factoryGateDecisionRequestSchema,
  type FactoryGate,
  type FactoryGateDecisionRequest
} from '@awk/types';
import { GatesService } from '../pipeline/gates.service';
import type { FactoryActorContext } from '../pipeline/types';
import { CurrentActor } from './current-actor.decorator';
import { toGateDto } from './mappers';
import { ZodValidationPipe } from './zod-validation.pipe';

/**
 * Única escritura que expone el control plane (D-030): decidir un gate
 * (aprobar / rechazar / complementar, docs/05). El reviewer sale SIEMPRE del
 * actor autenticado (JWT o PAT desde D-036) — nunca del body — para que la
 * auditoría de "quién aprobó qué" (docs/04) no dependa del cliente. Con actor
 * `gerente`, GatesService restringe a functional/manager_acceptance de SUS
 * proyectos (D-036). analyze/generate NO
 * tienen endpoint: siguen siendo comandos de CLI (runs largos del Agent SDK
 * sin cola de trabajos hasta Fase 3, D-029).
 */
@Controller('gates')
export class GatesController {
  constructor(private readonly gates: GatesService) {}

  @Post(':id/decision')
  @HttpCode(200)
  async decide(
    @Param('id') gateId: string,
    @Body(new ZodValidationPipe(factoryGateDecisionRequestSchema)) body: FactoryGateDecisionRequest,
    @CurrentActor() actor: FactoryActorContext
  ): Promise<FactoryGate> {
    const gate = await this.gates.decide({
      gateId,
      decision: body.decision,
      reviewer: actor.email,
      notes: body.notes,
      // El modelo de roles vive en GatesService (D-036): gerente solo
      // functional/manager_acceptance de SUS proyectos.
      actor
    });
    return toGateDto(gate);
  }
}
