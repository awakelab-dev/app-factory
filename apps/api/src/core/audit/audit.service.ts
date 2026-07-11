import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string;
  /** Convención "dominio.accion", p. ej. "auth.dev_login". */
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Auditoría append-only en core.audit_events. Registrar NUNCA debe tumbar
 * la operación de negocio: los fallos se degradan a warning en logs.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          actorId: entry.actorId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          metadata: entry.metadata as never
        }
      });
    } catch (err) {
      this.logger.warn(`No se pudo registrar auditoría "${entry.action}": ${String(err)}`);
    }
  }
}
