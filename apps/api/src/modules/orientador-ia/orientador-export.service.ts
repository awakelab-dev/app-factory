import { Injectable } from '@nestjs/common';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

const CSV_COLUMNS = [
  'id',
  'createdAt',
  'fullName',
  'email',
  'phone',
  'consentMarketing',
  'rawInputType',
  'declaredSector',
  'recommendedSector',
  'estimatedLevel',
  'analysisCount'
] as const;

/** Exportación de leads (panel admin, rol orientador_admin). CSV en vez de
 * .xlsx real deliberadamente: cubre el mismo caso de uso ("abrir en Excel")
 * sin sumar una dependencia nueva de generación de Excel al backend por un
 * solo endpoint — si más adelante se necesita un .xlsx con formato, se
 * reevalúa (ver docs/pipeline/orientador-ia/spec-tecnica.md). */
@Injectable()
export class OrientadorExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async exportLeadsCsv(adminUserId: string): Promise<string> {
    const rows = await this.prisma.orientadorLead.findMany({
      orderBy: { createdAt: 'desc' },
      include: { profile: true }
    });

    const lines = [CSV_COLUMNS.join(',')];
    for (const row of rows) {
      const record: Record<(typeof CSV_COLUMNS)[number], string> = {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        fullName: row.fullName,
        email: row.email,
        phone: row.phone ?? '',
        consentMarketing: String(row.consentMarketing),
        rawInputType: row.rawInputType,
        declaredSector: row.declaredSector ?? '',
        recommendedSector: row.profile?.recommendedSector ?? '',
        estimatedLevel: row.profile?.estimatedLevel ?? '',
        analysisCount: String(row.analysisCount)
      };
      lines.push(CSV_COLUMNS.map((col) => csvEscape(record[col])).join(','));
    }

    await this.prisma.orientadorExportLog.create({
      data: { adminUserId, leadCount: rows.length }
    });
    await this.audit.log({
      actorId: adminUserId,
      action: 'orientador_ia.export_leads',
      metadata: { leadCount: rows.length }
    });

    return lines.join('\n');
  }
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
