import { HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { OrientadorIntakeRequest, OrientadorIntakeResponse } from '@awk/types';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrientadorClaudeService } from './orientador-claude.service';
import { toProfileResponse } from './orientador-ia.mappers';

/** Tope anti-abuso confirmado en el gate spec (D-025): no es un presupuesto de
 * uso normal (1 análisis por persona es lo esperado), es un techo de seguridad
 * ante reintentos/abuso de un mismo candidato. */
export const ORIENTADOR_MAX_ANALYSES_PER_EMAIL = 50;

/**
 * Orquesta un POST /intake: a diferencia de moodle-insights, el análisis es
 * UNA llamada corta a Claude (segundos) — no hay patrón asíncrono con
 * polling, esta llamada responde ya con el perfil generado (spec técnica,
 * "Integración con Claude API").
 */
@Injectable()
export class OrientadorIntakeService {
  private readonly logger = new Logger(OrientadorIntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly claude: OrientadorClaudeService,
    private readonly audit: AuditService
  ) {}

  async submit(dto: OrientadorIntakeRequest): Promise<OrientadorIntakeResponse> {
    if (!this.claude.isConfigured) {
      throw new ServiceUnavailableException(
        'El análisis con IA no está configurado (falta ANTHROPIC_API_KEY, ver .env.example).'
      );
    }

    // Rate-limit por email (D-025): sin login, el candidato se identifica por
    // el email que declara en el consentimiento. Cada fila de `leads` = una
    // ejecución, así que el conteo previo es simplemente cuántas filas ya
    // existen con ese email.
    const priorCount = await this.prisma.orientadorLead.count({ where: { email: dto.email } });
    if (priorCount >= ORIENTADOR_MAX_ANALYSES_PER_EMAIL) {
      throw new HttpException(
        `Se alcanzó el límite de ${ORIENTADOR_MAX_ANALYSES_PER_EMAIL} análisis para este email.`,
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const lead = await this.prisma.orientadorLead.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        consentGiven: dto.consentGiven,
        consentMarketing: dto.consentMarketing,
        consentAt: new Date(),
        rawInputType: dto.rawInputType,
        rawInputText: dto.rawInputText,
        declaredSector: dto.declaredSector,
        declaredLevel: dto.declaredLevel,
        analysisCount: priorCount + 1
      }
    });

    try {
      const result = await this.claude.analyze({
        rawInputType: dto.rawInputType,
        rawInputText: dto.rawInputText,
        declaredSector: dto.declaredSector,
        declaredLevel: dto.declaredLevel
      });

      const profileRow = await this.prisma.orientadorProfile.create({
        data: {
          leadId: lead.id,
          recommendedSector: result.recommendedSector,
          rationale: result.rationale,
          estimatedLevel: result.estimatedLevel,
          skillGaps: result.skillGaps,
          llmModel: result.model,
          llmTokensUsed: result.tokensUsed
        }
      });

      await this.audit.log({
        action: 'orientador_ia.intake',
        entity: 'orientador_lead',
        entityId: lead.id,
        metadata: { recommendedSector: result.recommendedSector, model: result.model }
      });

      return { leadId: lead.id, profile: toProfileResponse(profileRow) };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`orientador-ia: análisis falló para lead ${lead.id}: ${message}`);
      await this.audit.log({
        action: 'orientador_ia.intake_error',
        entity: 'orientador_lead',
        entityId: lead.id,
        metadata: { error: message }
      });
      // El lead ya quedó guardado (con su rawInputText) aunque el análisis
      // falle: el candidato puede reintentar sin perder su cupo de forma
      // silenciosa, y el admin puede ver en el panel que ese lead no tiene
      // profile todavía.
      throw new ServiceUnavailableException(
        'No se pudo generar tu perfil en este momento. Puedes intentarlo de nuevo.'
      );
    }
  }
}
