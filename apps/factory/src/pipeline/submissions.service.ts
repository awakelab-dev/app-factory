import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PrototypeManifest } from '@awk/types';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateSubmissionInput {
  moduleSlug: string;
  displayName: string;
  /** HTML autocontenido del prototipo (la fuente completa). */
  sourceHtml: string;
  /** prototype.manifest.json YA validado con prototypeManifestSchema (el controller/tool valida antes). */
  manifest: PrototypeManifest;
  /** Email del actor autenticado (PAT/JWT) — nunca del body. */
  submittedBy: string;
}

/**
 * Alta de un prototipo enviado desde Cowork (submit_prototype → POST
 * /submissions, D-036). Crea el Project (`sourceType=cowork_prototype`) + la
 * fila de `prototype_submissions` con la fuente y el manifest en BD, y NADA
 * más: el análisis NO se dispara aquí (incremento A — control de costo y
 * D-030: sin cola de trabajos no se lanzan runs largos desde HTTP). El
 * proyecto queda en `received`; un dev corre `analyze <projectId>` por CLI,
 * que materializa la fuente desde BD (AnalysisRunnerService).
 */
@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSubmissionInput) {
    const existing = await this.prisma.project.findUnique({ where: { moduleSlug: input.moduleSlug } });
    if (existing) {
      throw new ConflictException(
        `Ya existe un proyecto con el slug "${input.moduleSlug}" (estado: ${existing.status}). ` +
          `Si quieres modificar ese módulo, usa request_change; si es un módulo distinto, elige otro slug (revisa list_modules).`
      );
    }
    // Transacción: nunca un Project cowork_prototype sin su submission (el
    // analyze materializaría desde una fila que no existe).
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          moduleSlug: input.moduleSlug,
          displayName: input.displayName,
          requestedBy: input.submittedBy,
          sourceType: 'cowork_prototype',
          sourceRef: 'db://prototype_submissions (pendiente)'
        }
      });
      const submission = await tx.prototypeSubmission.create({
        data: {
          projectId: project.id,
          manifest: input.manifest,
          source: input.sourceHtml,
          submittedBy: input.submittedBy
        }
      });
      // sourceRef queda como puntero humano-legible a la fuente real en BD
      // (el campo es descriptivo desde D-029; la fuente canónica es la fila).
      const updated = await tx.project.update({
        where: { id: project.id },
        data: { sourceRef: `db://prototype_submissions/${submission.id}` }
      });
      return { project: updated, submission };
    });
  }

  /** Última submission de un proyecto — lo que `analyze` materializa a disco. */
  async getLatestForProject(projectId: string) {
    const submission = await this.prisma.prototypeSubmission.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });
    if (!submission) {
      throw new NotFoundException(
        `El proyecto ${projectId} es cowork_prototype pero no tiene ninguna fila en prototype_submissions — no hay fuente que analizar.`
      );
    }
    return submission;
  }
}
