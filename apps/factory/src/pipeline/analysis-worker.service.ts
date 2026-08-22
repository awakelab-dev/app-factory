import { Injectable, Logger } from '@nestjs/common';
import { hostname } from 'node:os';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisJobsService } from './analysis-jobs.service';
import { AnalysisRunnerService } from './analysis-runner.service';
import { backoffMinutes, classifyFailure } from './failure-classifier';
import { GenerationRunnerService } from './generation-runner.service';
import { runGit } from './git-client';
import { PrMergeService } from './pr-merge.service';
import { ProjectsService } from './projects.service';
import { assertRunnerEnv } from './runner-env';
import { isGenerationKind, type AnalysisJobKind, type AnalysisJobRow, type ProjectStatus } from './types';
import { parseWorkerKinds } from './worker-kinds';

const DEFAULT_POLL_MS = 10_000;
const HEARTBEAT_MS = 30_000;

/** Estados de los que hay que sacar a un proyecto cuyo trabajo murió a mitad. */
const IN_FLIGHT_STATUSES: readonly ProjectStatus[] = ['analyzing', 'generating'];

/**
 * Worker de la Fábrica (D-047, incremento C; ampliado en D3). Corre en un
 * proceso APARTE del HTTP (`src/worker.ts`): toma trabajos de `analysis_jobs`
 * de uno en uno y ejecuta el runner que corresponda a su `kind`.
 *
 * **Se llama `AnalysisWorkerService` y ya no hace solo análisis**, igual que la
 * tabla se sigue llamando `analysis_jobs`: es la misma deuda cosmética, anotada
 * y no pagada a propósito (docs/09). Lo que un proceso concreto hace lo dice
 * `FACTORY_WORKER_KINDS`, no el nombre de la clase.
 *
 * Con D3 hay DOS contenedores de esta misma imagen:
 *   - `factory-runner`    → kinds `analysis,change_analysis`, checkout efímero.
 *   - `factory-generator` → kinds `generation,pr_merge`, checkout con
 *                           `node_modules` y credencial de push.
 *
 * Decisiones que conviene no perder:
 *  - **Concurrencia 1 por proceso**. Un análisis cuesta ~1,4 USD y una
 *    generación ~8; serializar acota gasto y RAM del Lightsail (compartido) sin
 *    más mecanismo que este bucle. Separar los dos workers evita además que una
 *    generación de 25 min bloquee un análisis de 3.
 *  - **El HTTP nunca ejecuta agentes** (D-030 sigue en pie): la tool encola,
 *    esto ejecuta. Un deploy del servicio `factory` no corta un run.
 *  - **Latido + barrido**: mientras un trabajo corre se refresca `heartbeatAt`;
 *    al arrancar y en cada vuelta se barren los trabajos `running` sin latido
 *    (proceso muerto) cerrando su `Run` y sacando al proyecto de `analyzing` o
 *    `generating`. Es el saneo manual por SQL que hubo que hacer en D-046.
 *  - **Reintento clasificado** (D3): un corte de red vuelve a la cola con
 *    backoff; un build en rojo no. Ver `failure-classifier.ts`.
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
    private readonly projects: ProjectsService,
    private readonly generation: GenerationRunnerService,
    private readonly prMerge: PrMergeService
  ) {}

  /** Kinds que sirve ESTE proceso. Se lee en cada acceso para poder testearlo. */
  get kinds(): readonly AnalysisJobKind[] {
    return parseWorkerKinds(process.env.FACTORY_WORKER_KINDS);
  }

  /** Bucle principal. No retorna hasta que se llame a `stop()`. */
  async loop(pollMs: number = Number(process.env.FACTORY_WORKER_POLL_MS ?? DEFAULT_POLL_MS)): Promise<void> {
    this.logger.log(
      `Worker de la Fábrica arrancado (${this.workerId}), kinds [${this.kinds.join(', ')}], poll cada ${pollMs} ms.`
    );
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
    this.logger.log('Worker de la Fábrica detenido.');
  }

  stop(): void {
    this.stopped = true;
  }

  /**
   * Una vuelta: barre trabajos muertos, toma el siguiente DE SUS KINDS y lo
   * ejecuta. Devuelve el trabajo procesado, o null si no había nada que hacer.
   * Separado del bucle para poder testearlo sin temporizadores.
   */
  async runOnce(): Promise<AnalysisJobRow | null> {
    await this.reapStale();

    const job = await this.jobs.claimNext(this.workerId, this.kinds);
    if (!job) return null;

    this.logger.log(
      `Trabajo tomado: ${job.id} (${job.kind}, proyecto ${job.projectId}, intento ${job.attempts}, pedido por ${job.requestedBy}).`
    );

    const heartbeat = setInterval(() => {
      void this.jobs.heartbeat(job.id).catch(() => undefined);
    }, HEARTBEAT_MS);
    // No mantiene vivo el proceso si el bucle termina.
    heartbeat.unref?.();

    try {
      // Dentro del try: si poner al día el checkout revienta por configuración,
      // el trabajo se cierra en error con el motivo en vez de quedarse
      // `running` hasta que lo barra el latido.
      await this.syncRepo(job.kind);
      await this.execute(job);
      await this.jobs.markSuccess(job.id);
    } catch (error) {
      await this.handleFailure(job, error);
    } finally {
      clearInterval(heartbeat);
    }

    return job;
  }

  /** Despacha el trabajo al runner de su kind. Lanza si falla (lo trata el llamador). */
  private async execute(job: AnalysisJobRow): Promise<void> {
    const hooks = { onRunStarted: (runId: string) => this.jobs.attachRun(job.id, runId) };

    switch (job.kind) {
      case 'analysis': {
        const spec = await this.analysis.runAnalysis(job.projectId, undefined, hooks);
        this.logger.log(`Trabajo ${job.id} completado: spec ${spec.id} (v${spec.version}), gates abiertos.`);
        return;
      }
      case 'change_analysis': {
        const spec = await this.analysis.runChangeAnalysis(this.requireChangeRequestId(job), undefined, hooks);
        this.logger.log(`Trabajo ${job.id} completado: spec ${spec.id} (v${spec.version}), gates abiertos.`);
        return;
      }
      case 'generation': {
        const run = await this.generation.runGeneration(this.requireSpecId(job, 'generation'), hooks);
        this.logger.log(`Trabajo ${job.id} completado: generación ${run.id}${run.prUrl ? ` (PR ${run.prUrl})` : ''}.`);
        return;
      }
      case 'pr_merge': {
        const result = await this.prMerge.runMerge(job.projectId, job.specId);
        this.logger.log(
          `Trabajo ${job.id} completado: PR ${result.prUrl ?? 'de la rama'} ${
            result.alreadyMerged ? 'ya estaba mergeada' : 'mergeada'
          }; proyecto en staging.`
        );
        return;
      }
      default: {
        // Un kind nuevo en la BD que este binario no conoce (despliegue a
        // medias): error claro en vez de un `undefined` silencioso.
        throw new Error(`Kind de trabajo no soportado por este worker: "${job.kind as string}".`);
      }
    }
  }

  /**
   * Clasifica el fallo y decide: reencolar con backoff (infraestructura) o
   * cerrar en error (todo lo demás). Ver `failure-classifier.ts` para el
   * porqué del "por defecto, fatal".
   *
   * El `Run` ya quedó cerrado en `error` CON SU COSTE por el propio runner
   * (D-047): un intento que gastó dinero se contabiliza aunque se reintente.
   */
  private async handleFailure(job: AnalysisJobRow, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const failureClass = classifyFailure(error);
    const delay = failureClass === 'retryable' ? backoffMinutes(job.attempts) : null;

    if (delay === null) {
      await this.jobs.markError(job.id, message);
      this.logger.error(
        `Trabajo ${job.id} fallido (${failureClass}, intento ${job.attempts}): ${message}` +
          (failureClass === 'retryable' ? ' — sin más reintentos automáticos.' : '')
      );
      return;
    }

    await this.jobs.requeueForRetry(
      job.id,
      delay,
      `Intento ${job.attempts} fallido por un problema de infraestructura; se reintenta en ${delay} min. Motivo: ${message}`
    );
    this.logger.warn(`Trabajo ${job.id} fallido (reintentable, intento ${job.attempts}): ${message}`);
  }

  private requireChangeRequestId(job: AnalysisJobRow): string {
    if (!job.changeRequestId) {
      throw new Error(`El trabajo ${job.id} es change_analysis pero no lleva changeRequestId — no hay cambio que analizar.`);
    }
    return job.changeRequestId;
  }

  private requireSpecId(job: AnalysisJobRow, kind: string): string {
    if (!job.specId) {
      throw new Error(`El trabajo ${job.id} es ${kind} pero no lleva specId — no hay spec que generar.`);
    }
    return job.specId;
  }

  /**
   * Trabajos cuyo worker murió a mitad: se marcan en error y se sanea lo que
   * colgaba de ellos — el `Run` que quedó en `running` y el proyecto atascado
   * en `analyzing`/`generating` (D-046, bug 1 en su versión "el proceso se
   * cayó").
   *
   * Barre TODOS los kinds, no solo los suyos: un trabajo muerto está muerto lo
   * sirva quien lo sirva, y si el generador se cae y no vuelve a levantar,
   * quien tiene que destapar el proyecto atascado es el otro worker.
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
      if (project && IN_FLIGHT_STATUSES.includes(project.status as ProjectStatus)) {
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
   * **Nunca para los kinds de generación, y eso es código, no configuración**
   * (D3): el checkout del generador vive en la rama `factory/<slug>` con el
   * trabajo del agente sin commitear, y un `reset --hard origin/main` a mitad
   * lo borraría entero. El contenedor `factory-generator` además trae
   * `FACTORY_WORKER_GIT_SYNC=0`, pero un despiste en un `.env` no puede costar
   * un módulo generado: la guarda va aquí.
   *
   * Para los kinds de análisis sigue DESACTIVADO por defecto y encendido
   * explícitamente en `factory-runner`: `git reset --hard` sobre el working
   * copy de un humano borraría su trabajo, y `PLATFORM_REPO_PATH` en un Mac
   * apunta a un checkout que Leonardo gestiona a mano.
   */
  private async syncRepo(kind: AnalysisJobKind, gitRunner: typeof runGit = runGit): Promise<void> {
    if (isGenerationKind(kind)) return;
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
