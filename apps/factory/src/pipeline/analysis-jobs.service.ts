import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AnalysisJobKind, AnalysisJobRow } from './types';

/**
 * Subconjunto del cliente Prisma que usa el encolado. Permite encolar DENTRO
 * de una transacción ya abierta (submit_prototype crea Project + submission +
 * trabajo de forma atómica) sin acoplar la firma al tipo del cliente completo.
 */
export interface AnalysisJobsTx {
  analysisJob: PrismaService['analysisJob'];
  $queryRaw: PrismaService['$queryRaw'];
}

export interface EnqueueInput {
  kind: AnalysisJobKind;
  projectId: string;
  /** Obligatorio para `change_analysis`. */
  changeRequestId?: string;
  requestedBy: string;
}

export interface EnqueueResult {
  job: AnalysisJobRow;
  /** true = ya había un trabajo activo para ese proyecto y se devuelve ESE. */
  alreadyQueued: boolean;
}

/** Un trabajo `running` sin latido durante este tiempo se da por muerto. */
const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Cola de trabajos de análisis (D-047, incremento C de Fase 2).
 *
 * Por qué existe: hasta ahora `submit_prototype` dejaba el proyecto en
 * `received` y `request_change` dejaba la petición sin analizar, porque un
 * análisis tarda ~5 minutos y D-030 prohibió (con razón) dispararlo desde una
 * request HTTP sin cola. Esto es esa cola — en Postgres, sin broker externo:
 * las tools encolan y devuelven al instante, y el worker (`src/worker.ts`)
 * consume.
 *
 * Dos garantías, las dos aprendidas en la prueba E2E (D-046):
 *  - **Un trabajo activo por proyecto**: dos envíos seguidos no producen dos
 *    runs sobre el mismo proyecto. Se serializa con un lock de fila sobre
 *    `projects` dentro de la transacción del encolado (no con un índice único
 *    parcial: Prisma no sabe declararlos y dejaría drift en el schema).
 *  - **Toma atómica** con `FOR UPDATE SKIP LOCKED`: si algún día hay más de un
 *    worker, dos no pueden tomar el mismo trabajo.
 */
@Injectable()
export class AnalysisJobsService {
  private readonly logger = new Logger(AnalysisJobsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Encola abriendo su propia transacción (camino de `request_change`). */
  async enqueue(input: EnqueueInput): Promise<EnqueueResult> {
    return this.prisma.$transaction((tx) => this.enqueueIn(tx as unknown as AnalysisJobsTx, input));
  }

  /**
   * Encola DENTRO de una transacción existente (camino de `submit_prototype`:
   * el proyecto, la submission y el trabajo se crean o no se crea nada).
   */
  async enqueueIn(tx: AnalysisJobsTx, input: EnqueueInput): Promise<EnqueueResult> {
    // Lock de fila del proyecto: serializa dos encolados simultáneos del mismo
    // proyecto sin bloquear al resto. Se libera al cerrar la transacción.
    await tx.$queryRaw`SELECT id FROM projects WHERE id = ${input.projectId}::uuid FOR UPDATE`;

    const active = await tx.analysisJob.findFirst({
      where: { projectId: input.projectId, status: { in: ['queued', 'running'] } },
      orderBy: { createdAt: 'asc' }
    });
    if (active) {
      return { job: active as AnalysisJobRow, alreadyQueued: true };
    }

    const job = await tx.analysisJob.create({
      data: {
        kind: input.kind,
        projectId: input.projectId,
        changeRequestId: input.changeRequestId,
        requestedBy: input.requestedBy
      }
    });
    this.logger.log(`Trabajo de análisis encolado (${input.kind}) para el proyecto ${input.projectId}: ${job.id}`);
    return { job: job as AnalysisJobRow, alreadyQueued: false };
  }

  /**
   * Toma el trabajo `queued` más antiguo y lo marca `running`, atómicamente.
   * `SKIP LOCKED` deja el camino abierto a varios workers sin cambiar nada.
   */
  async claimNext(workerId: string): Promise<AnalysisJobRow | null> {
    const rows = await this.prisma.$queryRaw<AnalysisJobRow[]>`
      UPDATE analysis_jobs SET
        status = 'running'::analysis_job_status,
        "workerId" = ${workerId},
        "claimedAt" = now(),
        "heartbeatAt" = now(),
        "updatedAt" = now(),
        attempts = attempts + 1
      WHERE id = (
        SELECT id FROM analysis_jobs
        WHERE status = 'queued'::analysis_job_status
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING *`;
    return rows[0] ?? null;
  }

  /**
   * Latido del worker mientras el trabajo corre (lo lee el barrido). Se escribe
   * con el `now()` de la BASE DE DATOS, no con el reloj del proceso: el worker
   * y la managed PG son máquinas distintas, y el barrido compara ese valor
   * contra el `now()` del servidor — mezclar los dos relojes haría que una
   * deriva mínima diera trabajos por muertos (o no los diera nunca).
   */
  async heartbeat(jobId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE analysis_jobs SET "heartbeatAt" = now(), "updatedAt" = now()
      WHERE id = ${jobId}::uuid AND status = 'running'::analysis_job_status`;
  }

  /** Enlaza el `Run` en cuanto el runner lo crea (para poder cerrarlo si el proceso muere). */
  async attachRun(jobId: string, runId: string): Promise<void> {
    await this.prisma.analysisJob.update({ where: { id: jobId }, data: { runId } });
  }

  async markSuccess(jobId: string): Promise<void> {
    await this.prisma.analysisJob.update({
      where: { id: jobId },
      data: { status: 'success', finishedAt: new Date(), errorMessage: null }
    });
  }

  async markError(jobId: string, errorMessage: string): Promise<void> {
    await this.prisma.analysisJob.update({
      where: { id: jobId },
      data: { status: 'error', finishedAt: new Date(), errorMessage }
    });
  }

  /**
   * Marca `error` todo trabajo `running` cuyo worker dejó de latir y devuelve
   * las filas afectadas para que el llamador sanee lo que colgaba de ellas
   * (el `Run` en `running` y el proyecto atascado en `analyzing`). Es la
   * respuesta al caso real de D-046: el proceso muere a mitad y todo se queda
   * en un estado que solo se arreglaba a mano con SQL.
   */
  async reapStale(staleAfterMs: number = STALE_AFTER_MS): Promise<AnalysisJobRow[]> {
    const staleAfterSeconds = Math.round(staleAfterMs / 1000);
    const minutes = Math.max(1, Math.round(staleAfterMs / 60000));
    const message =
      `El proceso que corría este análisis dejó de dar señales de vida (sin latido en ${minutes} min) — ` +
      'se da por muerto. El proyecto queda en error; se puede volver a encolar con `cli enqueue-analysis`.';
    // El umbral se calcula EN LA BASE (`now() - make_interval`), no en Node:
    // el latido también lo escribe la base, así que los dos lados de la
    // comparación salen del mismo reloj.
    return this.prisma.$queryRaw<AnalysisJobRow[]>`
      UPDATE analysis_jobs SET
        status = 'error'::analysis_job_status,
        "finishedAt" = now(),
        "updatedAt" = now(),
        "errorMessage" = ${message}
      WHERE status = 'running'::analysis_job_status
        AND ("heartbeatAt" IS NULL OR "heartbeatAt" < now() - make_interval(secs => ${staleAfterSeconds}))
      RETURNING *`;
  }

  /** Trabajos de un proyecto, más reciente primero (diagnóstico por CLI). */
  async listForProject(projectId: string): Promise<AnalysisJobRow[]> {
    const jobs = await this.prisma.analysisJob.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });
    return jobs as AnalysisJobRow[];
  }
}
