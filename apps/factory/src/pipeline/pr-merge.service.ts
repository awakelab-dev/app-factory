import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GatesService } from './gates.service';
import { runGh, runGit } from './git-client';
import { ProjectsService } from './projects.service';
import { assertRunnerEnv } from './runner-env';
import type { ProjectStatus } from './types';

/** Cuánto se espera a que la CI de la PR termine antes de dar el intento por perdido. */
const DEFAULT_CHECKS_TIMEOUT_MS = 30 * 60 * 1000;

export interface PrMergeDeps {
  runGit?: typeof runGit;
  runGh?: typeof runGh;
}

export interface PrMergeResult {
  prUrl: string | null;
  /** true = la PR ya estaba MERGED cuando llegamos (reintento idempotente). */
  alreadyMerged: boolean;
}

interface PrView {
  url?: string;
  state?: string;
  number?: number;
  /** CLEAN | DIRTY | BLOCKED | UNKNOWN… (GitHub). DIRTY = conflictos con la base. */
  mergeStateStatus?: string;
}

/**
 * Bloque 6 de docs/09: aprobar el gate `pr_review` ya no transiciona el
 * proyecto a `staging` — encola este trabajo, que **comprueba la realidad** y
 * solo entonces mueve el estado.
 *
 * El porqué es D-049: los gates son declarativos. Aprobar `pr_review` dejaba el
 * proyecto en `staging` aunque la PR siguiera abierta, con la CI en rojo o con
 * un conflicto — el estado decía una cosa y `main` otra, y el desfase solo se
 * descubría al ir a validar el módulo. Aquí el estado lo mueve quien vio el
 * merge hecho.
 *
 * Lo que NO cambia, y es lo que sostiene todo lo demás: `pr_review` sigue
 * siendo un gate SOLO-ADMIN que exige que una persona lea el diff. Esto
 * automatiza el `gh pr merge` posterior, no la revisión.
 */
@Injectable()
export class PrMergeService {
  private readonly logger = new Logger(PrMergeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly gates: GatesService
  ) {}

  /**
   * Espera los checks, mergea con squash y lleva el proyecto a `staging`.
   *
   * Lanza si algo no se cumple: quien llama (el worker) clasifica el fallo y
   * decide entre reintentar y dejarlo en error. El proyecto se queda en
   * `pr_review` en ese caso — visible en `/factory` con su motivo, que es
   * justo lo que el bloque 5 puso ahí.
   */
  async runMerge(projectId: string, specId: string | null, deps: PrMergeDeps = {}): Promise<PrMergeResult> {
    const { repoPath } = assertRunnerEnv();
    const gitRunner = deps.runGit ?? runGit;
    const ghRunner = deps.runGh ?? runGh;

    const project = await this.projects.findById(projectId);
    const branchName = `factory/${project.moduleSlug}`;

    const pr = await this.viewPr(branchName, repoPath, ghRunner);
    if (!pr) {
      throw new Error(
        `No hay ninguna PR para la rama ${branchName} — no se puede mergear. ` +
          'Comprueba que la generación llegó a empujar la rama y abrir la PR (Run del proyecto en /factory).'
      );
    }

    const alreadyMerged = pr.state === 'MERGED';
    if (!alreadyMerged) {
      if (pr.state !== 'OPEN') {
        // CLOSED sin mergear: alguien la descartó a mano. Fatal a propósito —
        // reintentarlo no la reabre, y llevar el proyecto a staging sería
        // exactamente la mentira que este bloque elimina.
        throw new Error(
          `La PR ${pr.url ?? branchName} está en estado ${pr.state ?? 'desconocido'}, no OPEN ni MERGED: ` +
            'se cerró sin mergear. Decide qué hacer con el proyecto a mano (regenerar o rechazar).'
        );
      }
      // Una PR con CONFLICTOS no tiene checks: GitHub no puede construir el
      // merge ref (`refs/pull/N/merge`), así que los workflows de
      // `pull_request` NUNCA se crean y `gh pr checks` sale con "no checks
      // reported on the '<rama>' branch". Ese fue el error visible de la
      // primera generación real (`panel-prioridades`, 2026-08-27) y apuntaba a
      // los checks estando el problema dos pasos más atrás. Se comprueba antes
      // de esperar, para que el motivo del trabajo diga la verdad.
      if (pr.mergeStateStatus === 'DIRTY') {
        throw new Error(
          `La PR ${pr.url ?? branchName} tiene CONFLICTOS con main (mergeStateStatus=DIRTY): no se puede mergear y ` +
            'GitHub tampoco ejecuta sus checks, así que esperarlos no serviría de nada. Resuelve los conflictos en la ' +
            'rama —o bórrala y regenera desde main al día— y repón el merge con ' +
            '`cli enqueue-generation --spec <specId> --kind pr_merge`.'
        );
      }
      await this.waitForChecks(branchName, repoPath, ghRunner);
      await ghRunner(['pr', 'merge', branchName, '--squash', '--delete-branch'], repoPath);
      this.logger.log(`PR ${pr.url ?? branchName} mergeada con squash y rama remota borrada.`);
    } else {
      this.logger.log(`La PR ${pr.url ?? branchName} ya estaba MERGED — se salta el merge y se sincroniza el estado.`);
    }

    // El estado se mueve DESPUÉS de comprobar la realidad, y solo si hace falta:
    // un reintento sobre una PR ya mergeada no debe fallar por transición
    // inválida (`staging → staging` no existe).
    if ((project.status as ProjectStatus) !== 'staging') {
      await this.projects.transition(projectId, 'staging');
    }

    // El gate de aceptación del gerente se abre AQUÍ, no al aprobar pr_review:
    // el gerente valida el módulo EN staging, y hasta que la PR no está en
    // `main` no hay nada que validar. Idempotente para el reintento.
    if (specId) await this.openManagerAcceptanceOnce(specId);

    await this.cleanupBranch(branchName, repoPath, gitRunner);

    return { prUrl: pr.url ?? null, alreadyMerged };
  }

  private async viewPr(branchName: string, repoPath: string, ghRunner: typeof runGh): Promise<PrView | null> {
    try {
      const { stdout } = await ghRunner(['pr', 'view', branchName, '--json', 'url,state,number,mergeStateStatus'], repoPath);
      return JSON.parse(stdout) as PrView;
    } catch (error) {
      // `gh pr view` sale con error tanto si no hay PR como si no hay red. Se
      // distinguen por el mensaje: sin red el fallo es reintentable y tiene que
      // propagarse como tal, no convertirse en "no hay PR" (que es fatal).
      const message = error instanceof Error ? error.message : String(error);
      if (/no pull requests found|could not resolve to a pullrequest|no pull request found/i.test(message)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * `gh pr checks --watch` bloquea hasta que la CI termina y sale con código
   * distinto de 0 si algún check falla. `--fail-fast` corta en cuanto uno cae:
   * no tiene sentido esperar 10 minutos más a los que quedan si ya sabemos que
   * no se va a mergear.
   */
  private async waitForChecks(branchName: string, repoPath: string, ghRunner: typeof runGh): Promise<void> {
    const timeoutMs = Number(process.env.FACTORY_PR_CHECKS_TIMEOUT_MS ?? DEFAULT_CHECKS_TIMEOUT_MS);
    this.logger.log(`Esperando a la CI de ${branchName} (máx. ${Math.round(timeoutMs / 60000)} min)…`);
    await ghRunner(['pr', 'checks', branchName, '--watch', '--fail-fast', '--interval', '30'], repoPath, {
      timeoutMs
    });
    this.logger.log(`CI de ${branchName} en verde.`);
  }

  /** Abre `manager_acceptance` para la spec si no hay ya uno pendiente (reintentos). */
  private async openManagerAcceptanceOnce(specId: string): Promise<void> {
    const existing = await this.prisma.gate.findFirst({
      where: { specId, gateType: 'manager_acceptance', status: 'pending' }
    });
    if (existing) {
      this.logger.log(`Ya había un gate manager_acceptance pendiente para la spec ${specId}: no se abre otro.`);
      return;
    }
    await this.gates.openGatesForSpec(specId, ['manager_acceptance']);
  }

  /**
   * Deja el checkout de generación en `main` al día y borra la rama local ya
   * mergeada. Sin esto, `/platform-repo-gen` —que a diferencia del checkout de
   * análisis NO se resetea nunca— acumularía ramas viejas, y el próximo
   * `request_change` del mismo módulo reutilizaría una `factory/<slug>`
   * anclada a un `main` de hace semanas (`createOrReuseBranch` reutiliza la
   * rama si existe, que es lo correcto para una REgeneración de la misma
   * vuelta y lo incorrecto para una nueva).
   *
   * Best-effort a propósito: la PR ya está mergeada y el proyecto ya está en
   * `staging`. Si esto falla, el trabajo NO debe caer — se avisa y se limpia a
   * mano.
   */
  private async cleanupBranch(branchName: string, repoPath: string, gitRunner: typeof runGit): Promise<void> {
    try {
      await gitRunner(['checkout', '--force', 'main'], repoPath);
      await gitRunner(['fetch', '--prune', '--quiet'], repoPath);
      await gitRunner(['reset', '--hard', 'origin/main'], repoPath);
      await gitRunner(['branch', '-D', branchName], repoPath);
      this.logger.log(`Checkout de generación devuelto a origin/main y rama local ${branchName} borrada.`);
    } catch (error) {
      this.logger.warn(
        `No se pudo limpiar el checkout de generación tras el merge (no afecta al proyecto, ya está en staging): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
