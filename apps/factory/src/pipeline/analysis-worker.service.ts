import { Injectable, Logger } from '@nestjs/common';
import { hostname } from 'node:os';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisJobsService } from './analysis-jobs.service';
import { AnalysisRunnerService } from './analysis-runner.service';
import { runGit } from './git-client';
import { ProjectsService } from './projects.service';
import { assertRunnerEnv } from './runner-env';
import type { AnalysisJobRow } from './types';

const DEFAULT_POLL_MS = 10_000;
const HEARTBEAT_MS = 30_000;

/**
 * Worker de análisis (D-047, incremento C). Corre en un proceso APARTE del
 * HTTP (`src/worker.ts` → servicio `factory-runner` del compose): toma
 * trabajos de `analysis_jobs` de uno en uno y ejecuta el runner del Agent SDK
 * que corresponda.
 *
 * Decisiones que conviene no perder:
 *  - **Concurrencia 1**. Un análisis cuesta ~1,4 USD y cualquiera con el
 *    conector puede disparar uno; serializar acota el gasto y la RAM del
 *    Lightsail (que es compartido) sin más mecanismo que este bucle.
 *  - **El HTTP nunca ejecuta agentes** (D-030 sigue en pie): la tool encola,
 *    esto ejecuta. Un deploy del servicio `factory` no corta un análisis.
 *  - **Latido + barrido**: mientras un trabajo corre se refresca `heartbeatAt`;
 *    al arrancar y en cada vuelta se barren los trabajos `running` sin latido
 *    (proceso muerto) cerrando su `Run` y sacando al proyecto de `analyzing`.
 *    Es exactamente el saneo manual por SQL que hubo que hacer en D-046.
 */
@Injectable()
export class AnalysisWorkerService {
  private readonly logger = new Logger(AnalysisWorkerService.name);
  private readonly workerId = `${hostname()}:${process.pid}`;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: AnalysisJobsService,
    private readonly analysis: AnalysisRunnerService,
    private readonly projects: ProjectsService
  ) {}

  /** Bucle principal. No retorna hasta que se llame a `stop()`. */
  async loop(pollMs: number = Number(process.env.FACTORY_WORKER_POLL_MS ?? DEFAULT_POLL_MS)): Promise<void> {
    this.logger.log(`Worker de análisis arrancado (${this.workerId}), poll cada ${pollMs} ms.`);
    while (!this.stopped) {
      let job: AnalysisJobRow | null = null;
      try {
        job = await this.runOnce();
      } catch (error) {
        // Un fallo del propio bucle (BD caída, p. ej.) no debe tumbar el
        // proceso: se registra y se reintenta en la vuelta siguiente.
        this.logger.error(`Vuelta del worker fallida: ${error instanceof Error ? error.message : String(error)}`);
      }
      // Si acaba de procesar algo, encadena sin esperar: puede haber cola.
      if (!job && !this.stopped) await this.sleep(pollMs);
    }
    this.logger.log('Worker de análisis detenido.');
  }

  stop(): void {
    this.stopped = true;
  }

  /**
   * Una vuelta: barre trabajos muertos, toma el siguiente y lo ejecuta.
   * Devuelve el trabajo procesado, o null si no había nada que hacer.
   * Separado del bucle para poder testearlo sin temporizadores.
   */
  async runOnce(): Promise<AnalysisJobRow | null> {
    await this.reapStale();

    const job = await this.jobs.claimNext(this.workerId);
    if (!job) return null;

    this.logger.log(`Trabajo tomado: ${job.id} (${job.kind}, proyecto ${job.projectId}, pedido por ${job.requestedBy}).`);

    const heartbeat = setInterval(() => {
      void this.jobs.heartbeat(job.id).catch(() => undefined);
    }, HEARTBEAT_MS);
    // No mantiene vivo el proceso si el bucle termina.
    heartbeat.unref?.();

    try {
      // Dentro del try: si poner al día el checkout revienta por configuración,
      // el trabajo se cierra en error con el motivo en vez de quedarse
      // `running` hasta que lo barra el latido.
      await this.syncRepo();
      const hooks = { onRunStarted: (runId: string) => this.jobs.attachRun(job.id, runId) };
      const spec =
        job.kind === 'change_analysis'
          ? await this.analysis.runChangeAnalysis(this.requireChangeRequestId(job), undefined, hooks)
          : await this.analysis.runAnalysis(job.projectId, undefined, hooks);
      await this.jobs.markSuccess(job.id);
      this.logger.log(`Trabajo ${job.id} completado: spec ${spec.id} (v${spec.version}), gates abiertos.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.jobs.markError(job.id, message);
      this.logger.error(`Trabajo ${job.id} fallido: ${message}`);
    } finally {
      clearInterval(heartbeat);
    }

    return job;
  }

  private requireChangeRequestId(job: AnalysisJobRow): string {
    if (!job.changeRequestId) {
      throw new Error(`El trabajo ${job.id} es change_analysis pero no lleva changeRequestId — no hay cambio que analizar.`);
    }
    return job.changeRequestId;
  }

  /**
   * Trabajos cuyo worker murió a mitad: se marcan en error y se sanea lo que
   * colgaba de ellos — el `Run` que quedó en `running` y el proyecto atascado
   * en `analyzing` (D-046, bug 1 en su versión "el proceso se cayó").
   */
  async reapStale(): Promise<void> {
    const stale = await this.jobs.reapStale();
    for (const job of stale) {
      this.logger.warn(`Trabajo ${job.id} dado por muerto (worker ${job.workerId ?? 'desconocido'}): saneando.`);
      if (job.runId) {
        await this.prisma.run.updateMany({
          where: { id: job.runId, status: 'running' },
          data: {
            status: 'error',
            finishedAt: new Date(),
            errorMessage: job.errorMessage ?? 'El proceso del runner murió a mitad del run.'
          }
        });
      }
      const project = await this.prisma.project.findUnique({ where: { id: job.projectId } });
      if (project?.status === 'analyzing') {
        await this.projects.transition(job.projectId, 'error');
      }
    }
  }

  /**
   * Pone el checkout del runner al día antes de analizar: el agente lee el
   * código vivo de los módulos (antiduplicación y, en un cambio, el módulo a
   * modificar), así que un checkout viejo produce specs sobre una realidad que
   * ya no existe. `reset --hard` + `clean` de docs/pipeline implementan la
   * decisión "la BD es canónica, el checkout es efímero": lo que el agente
   * escribe en disco es un subproducto — la spec vive en `Spec`.
   *
   * DESACTIVADO por defecto y encendido explícitamente en el contenedor
   * `factory-runner`: `git reset --hard` sobre el working copy de un humano
   * borraría su trabajo, y `PLATFORM_REPO_PATH` en un Mac apunta a un checkout
   * que Leonardo gestiona a mano.
   */
  private async syncRepo(gitRunner: typeof runGit = runGit): Promise<void> {
    if (process.env.FACTORY_WORKER_GIT_SYNC !== '1') return;
    const { repoPath } = assertRunnerEnv();
    const ref = process.env.PLATFORM_REPO_REF ?? 'origin/main';
    try {
      await gitRunner(['fetch', '--prune', '--quiet'], repoPath);
      await gitRunner(['reset', '--hard', ref], repoPath);
      await gitRunner(['clean', '-fd', 'docs/pipeline'], repoPath);
      this.logger.log(`Checkout del runner sincronizado a ${ref}.`);
    } catch (error) {
      // Sin red o sin credenciales de lectura: se analiza con lo que haya en
      // el checkout y se avisa. Mejor una spec sobre un repo de ayer que
      // ninguna spec.
      this.logger.warn(
        `No se pudo sincronizar el checkout del runner con ${ref} (se analiza con lo que hay en disco): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Espera entre vueltas. El timer NO se hace `unref`: es lo único que mantiene
   * vivo el proceso del worker entre trabajo y trabajo — con `unref` el bucle
   * quedaría esperando una promesa que nadie resuelve y el contenedor saldría
   * en silencio.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
