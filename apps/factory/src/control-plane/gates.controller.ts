import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import {
  factoryGateDecisionRequestSchema,
  type FactoryGate,
  type FactoryGateDecisionRequest
} from '@awk/types';
import { GatesService } from '../pipeline/gates.service';
import { CurrentUser, type RequestUser } from './current-user.decorator';
import { toGateDto } from './mappers';
import { ZodValidationPipe } from './zod-validation.pipe';

/**
 * Única escritura que expone el control plane (D-030): decidir un gate
 * (aprobar / rechazar / complementar, docs/05). El reviewer sale SIEMPRE del
 * JWT verificado — nunca del body — para que la auditoría de "quién aprobó
 * qué" (docs/04) no dependa de lo que diga el cliente. analyze/generate NO
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
    @CurrentUser() user: RequestUser
  ): Promise<FactoryGate> {
    const gate = await this.gates.decide({
      gateId,
      decision: body.decision,
      reviewer: user.email,
      notes: body.notes
    });
    return toGateDto(gate);
  }
}
