import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { runAgent, toUsageFields, type AgentRunResult, type AgentUsage } from './agent-sdk.client';
import { GatesService } from './gates.service';
import { runGh, runGit } from './git-client';
import { generateMigrationForBranch, EXTRA_SQL_FILENAME } from './migration-generator';
import { assertPrismaCli, runPrisma } from './prisma-client';
import { ProjectsService } from './projects.service';
import { assertRunnerEnv } from './runner-env';
import type { GateType } from './types';

const DEFAULT_MODEL = 'claude-sonnet-5';

const DEFAULT_REQUIRED_GATES: GateType[] = ['functional', 'technical'];

// Comandos que el propio Bash del agente nunca puede correr, incluso dentro
// de su cwd/writableRoots. git add/commit/push y la apertura de PR los hace
// código nuestro DESPUÉS de que el agente termina (ver tryOpenPullRequest) —
// separación deliberada: el agente solo escribe código y corre build/test.
const BLOCKED_BASH_PATTERNS: RegExp[] = [
  /\bgit\s+push\b/,
  /\bgit\s+commit\b/,
  /\bsudo\b/,
  /\brm\s+-rf\s+\//,
  /\bgit\s+reset\s+--hard\b/
];

export interface GenerationOptions {
  requiredGates?: GateType[];
  /**
   * Se llama en cuanto el `Run` existe (D3). El worker lo usa para enlazar el
   * Run con su trabajo de la cola ANTES de que el agente empiece: si el proceso
   * muere a mitad de una generación de 25 minutos, el barrido necesita saber
   * qué `Run` cerrar. Es la misma mecánica que ya tenía el runner de análisis
   * (D-047) — sin ella, una generación muerta dejaba el `Run` en `running`
   * para siempre, que es el bug 1 de D-046 otra vez.
   */
  onRunStarted?: (runId: string) => void | Promise<void>;
}

export interface GenerationRunnerDeps {
  agentRunner?: typeof runAgent;
  runGit?: typeof runGit;
  runGh?: typeof runGh;
  runPrisma?: typeof runPrisma;
  /** Inyectable solo para los tests (evita ejecutar git/prisma de verdad). */
  generateMigration?: typeof generateMigrationForBranch;
}

/**
 * Runner de GENERACIÓN (docs/04, paso 4): con la spec ya aprobada, crea una
 * rama `factory/<slug>`, invoca el Agent SDK headless con escritura acotada
 * a las carpetas del módulo (docs/02-stack.md), corre build/lint/test, y —
 * si hay red/`gh` CLI disponibles — abre la PR. Si no (frecuente en el
 * sandbox de Cowork, D-016/D-023), la rama queda commiteada localmente y el
 * proyecto avanza igual a `verifying`: un dev empuja/abre la PR a mano y usa
 * `advance` para reflejar el estado real observado.
 *
 * Exige (docs/05: "nunca se genera desde una spec sin gate") que los gates
 * requeridos estén `approved` — por defecto, funcional Y técnico.
 */
@Injectable()
export class GenerationRunnerService {
  private readonly logger = new Logger(GenerationRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
    private readonly gates: GatesService
  ) {}

  /** Solo válido tras `assertRunnerEnv()` (primera línea de runGeneration). */
  private get repoPath(): string {
    return assertRunnerEnv().repoPath;
  }

  async runGeneration(specId: string, options: GenerationOptions = {}, deps: GenerationRunnerDeps = {}) {
    // Entorno completo ANTES de tocar estado, igual que en el runner de
    // análisis (D-046 bug 1 — "revisar también el runner de generación").
    const { repoPath } = assertRunnerEnv();
    // D2: la generación escribe la migración con el CLI de Prisma del checkout.
    // Se comprueba AQUÍ, antes de transicionar y antes de gastar un agente
    // (misma regla de D-047 que motivó assertRunnerEnv).
    assertPrismaCli(repoPath);
    const agentRunner = deps.agentRunner ?? runAgent;
    const gitRunner = deps.runGit ?? runGit;
    const ghRunner = deps.runGh ?? runGh;
    const prismaRunner = deps.runPrisma ?? runPrisma;
    const migrationGenerator = deps.generateMigration ?? generateMigrationForBranch;

    const spec = await this.prisma.spec.findUnique({
      where: { id: specId },
      include: { project: true }
    });
    if (!spec) {
      // Error crudo de Prisma ("No record was found") → mensaje accionable.
      // El tropiezo típico es pasar un projectId donde va un specId: lo
      // detectamos y apuntamos a "status" para sacar el specId correcto.
      const projectByThatId = await this.prisma.project.findUnique({ where: { id: specId } });
      if (projectByThatId) {
        throw new BadRequestException(
          `"${specId}" es un projectId, no un specId. "generate" recibe el ID de una spec. ` +
            `Corre "status ${specId}" para ver la última spec del proyecto "${projectByThatId.moduleSlug}" y usa el campo "id" de esa spec.`
        );
      }
      throw new BadRequestException(
        `No existe ninguna spec con id "${specId}" (tampoco un proyecto con ese id). ` +
          `Los specId salen de "analyze <projectId>" o de "status <projectId>".`
      );
    }

    const requiredGates = options.requiredGates ?? DEFAULT_REQUIRED_GATES;
    const approved = await this.gates.areSpecGatesApproved(specId, requiredGates);
    if (!approved) {
      throw new BadRequestException(
        `La spec ${specId} no tiene todos los gates requeridos (${requiredGates.join(', ')}) aprobados — no se puede generar (docs/05-gobernanza-seguridad.md).`
      );
    }

    // Las decisionNotes de los gates aprobados son parte del contrato de
    // generación (docs/05: el revisor puede "complementar" — sus precisiones
    // son vinculantes). Lección del primer encargo real (gestor-proyectos,
    // 2026-07-19): la instrucción "reasignar tareas es SOLO admin" vivía en
    // las notas del gate técnico y el agente nunca la vio, porque el prompt
    // solo llevaba las specs. Ahora viajan siempre.
    const specGates = await this.prisma.gate.findMany({
      where: { specId, status: 'approved' },
      orderBy: { createdAt: 'asc' }
    });
    const gateNotesBlock = specGates
      .filter((gate) => gate.decisionNotes?.trim())
      .map((gate) => `[gate ${gate.gateType} — ${gate.reviewer}]\n${gate.decisionNotes?.trim()}`)
      .join('\n\n');

    const project = spec.project;
    const branchName = `factory/${project.moduleSlug}`;

    // Transición ANTES de crear el Run — mismo motivo que en
    // AnalysisRunnerService: una transición inválida no debe dejar un Run
    // huérfano en "running".
    await this.projects.transition(project.id, 'generating');
    const run = await this.prisma.run.create({
      data: {
        projectId: project.id,
        specId,
        runType: 'generation',
        status: 'running',
        startedAt: new Date(),
        branchName
      }
    });
    await options.onRunStarted?.(run.id);

    try {
      await this.createOrReuseBranch(branchName, gitRunner);
    } catch (error) {
      return this.fail(
        run.id,
        project.id,
        `No se pudo crear/usar la rama ${branchName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const writableRoots = [
      join(this.repoPath, 'apps/api/src/modules', project.moduleSlug),
      join(this.repoPath, 'apps/web/src/modules', project.moduleSlug),
      join(this.repoPath, 'apps/api/prisma/schema.prisma')
    ];

    const prompt = [
      `Módulo a generar: ${project.moduleSlug} (${project.displayName}).`,
      '--- SPEC TÉCNICA APROBADA ---',
      spec.technicalContent,
      '--- SPEC FUNCIONAL APROBADA (contexto de negocio) ---',
      spec.functionalContent,
      ...(gateNotesBlock
        ? [
            '--- NOTAS DE LOS GATES APROBADOS (instrucciones del revisor: VINCULANTES; si contradicen algún detalle de la spec, prevalecen las notas) ---',
            gateNotesBlock
          ]
        : [])
    ].join('\n\n');

    let result: AgentRunResult;
    try {
      result = await agentRunner({
        prompt,
        cwd: this.repoPath,
        systemPrompt: GENERATION_SYSTEM_PROMPT,
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        writableRoots,
        isBashCommandAllowed: (command) => !BLOCKED_BASH_PATTERNS.some((pattern) => pattern.test(command)),
        maxTurns: 200
      });
    } catch (error) {
      return this.fail(run.id, project.id, error instanceof Error ? error.message : String(error));
    }

    if (!result.success) {
      // Con el consumo: un run caído gastó igual (D-046, hueco (a)).
      return this.fail(run.id, project.id, result.errorMessage ?? 'El run de generación no tuvo éxito.', result);
    }

    // Migración: DESPUÉS del agente y ANTES del commit, para que el .sql entre
    // en la misma PR y se revise en el gate técnico (incremento D, bloque 3a).
    try {
      const migration = await migrationGenerator(
        { repoPath, moduleSlug: project.moduleSlug },
        { runGit: gitRunner, runPrisma: prismaRunner }
      );
      if (migration) {
        this.logger.log(
          `Migración generada para "${project.moduleSlug}": ${migration.dirName}` +
            ` (base ${migration.baseSha.slice(0, 7)}` +
            `${migration.includesExtraSql ? `, con ${EXTRA_SQL_FILENAME}` : ''})` +
            (migration.removedDirs.length > 0
              ? `. Reescrita sobre la vuelta anterior de esta rama: ${migration.removedDirs.join(', ')}`
              : '')
        );
      } else {
        this.logger.log(`Sin cambios de esquema para "${project.moduleSlug}": no se genera migración.`);
      }
    } catch (error) {
      // Falla el run entero a propósito. Una PR con el modelo en schema.prisma
      // pero sin su .sql es justo el paso manual que D2 elimina: dejarlo pasar
      // devolvería el "500 silencioso en staging" que STATUS documenta dos veces.
      return this.fail(
        run.id,
        project.id,
        `El código se generó pero no se pudo escribir la migración de "${project.moduleSlug}": ${
          error instanceof Error ? error.message : String(error)
        }`,
        result
      );
    }

    let prUrl: string | null;
    try {
      prUrl = await this.tryOpenPullRequest(
        branchName,
        project.moduleSlug,
        project.displayName,
        specId,
        gitRunner,
        ghRunner
      );
    } catch (error) {
      // Lo único que lanza aquí a propósito es el guardarraíl de alcance
      // (`assertOnlyOwnModule`): el código se generó, pero NO puede salir del
      // checkout. Falla el run entero —con su consumo, D-046 hueco (a)— para
      // que el motivo se vea en /factory y el proyecto no se quede en
      // `generating` con un Run huérfano. Sin red/`gh`, `tryOpenPullRequest`
      // sigue avisando y devolviendo null, sin pasar por aquí.
      return this.fail(run.id, project.id, error instanceof Error ? error.message : String(error), result);
    }

    await this.prisma.run.update({
      where: { id: run.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        prUrl: prUrl ?? undefined,
        agentSessionId: result.sessionId,
        outputSummary: result.resultText,
        costUsd: result.costUsd,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens
      }
    });

    await this.projects.transition(project.id, 'verifying');
    if (prUrl) {
      await this.projects.transition(project.id, 'pr_review');
      // Gate de revisión de PR de primera clase (2026-07-19): antes la
      // revisión docs/05 quedaba solo como comentario en GitHub + `advance`
      // manual, sin fila auditable. Ahora se abre el gate y se decide en
      // /factory (aprobar → staging; complementar → regenerar). Cada ciclo de
      // regeneración que vuelve a pr_review abre uno fresco (historial).
      await this.gates.openGatesForSpec(specId, ['pr_review']);
    }

    this.logger.log(
      `Generación completa para "${project.moduleSlug}" en rama ${branchName}` +
        (prUrl ? ` (PR: ${prUrl}).` : ' (sin PR automática — empujar/abrir a mano, luego usar "advance").')
    );
    // Gap 5 (2026-07-19): `run` es el objeto de CREACIÓN (status `running`, sin
    // prUrl/costo/tokens). Releerlo para que el CLI imprima el estado FINAL
    // real en vez de confundir con "en curso" cuando ya terminó.
    return this.prisma.run.findUniqueOrThrow({ where: { id: run.id } });
  }

  /**
   * Prepara la rama del módulo. Una rama NUEVA nace SIEMPRE de `origin/main`
   * recién traído; una que ya existe (regeneración de la misma vuelta) se
   * reutiliza tal cual, que es lo que quiere una PR incremental.
   *
   * Antes hacía `checkout -b` sobre lo que hubiera en HEAD, y eso rompió con la
   * PRIMERA generación real (`panel-prioridades`, 2026-08-27): el checkout de
   * generación es PERSISTENTE, `syncRepo` no lo toca a propósito (D-053, un
   * `reset --hard` ahí borraría trabajo sin commitear) y `cleanupBranch` solo
   * lo devuelve a `origin/main` TRAS un merge con éxito — que nunca había
   * ocurrido. Estaba aparcado en `factory/mesa-ayuda`, así que la rama de
   * `panel-prioridades` nació de ahí y se llevó dentro la versión VIEJA de
   * mesa-ayuda: la PR salió `DIRTY` con 9 archivos en conflicto y, sin ese
   * conflicto, el squash habría REVERTIDO en `main` los arreglos de ese
   * módulo. El `fetch` es obligatorio (no best-effort): basar 1,35 USD de
   * generación en un `origin/main` viejo es justo el fallo que esto arregla, y
   * un fallo de red se clasifica como reintentable y vuelve solo.
   */
  private async createOrReuseBranch(branchName: string, gitRunner: typeof runGit): Promise<void> {
    await gitRunner(['fetch', 'origin', '--prune', '--quiet'], this.repoPath);
    if (await this.branchExists(branchName, gitRunner)) {
      await gitRunner(['checkout', branchName], this.repoPath);
      this.logger.log(`Rama ${branchName} ya existente: se reutiliza (regeneración incremental).`);
      return;
    }
    await gitRunner(['checkout', '-B', branchName, 'origin/main'], this.repoPath);
    this.logger.log(`Rama ${branchName} creada desde origin/main al día.`);
  }

  private async branchExists(branchName: string, gitRunner: typeof runGit): Promise<boolean> {
    try {
      await gitRunner(['rev-parse', '--verify', '--quiet', `refs/heads/${branchName}`], this.repoPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Guardarraíl de alcance: una generación NUNCA debe tocar archivos de otro
   * módulo. Si lo hace, no se empuja nada — es la señal de que la rama nació
   * contaminada (ver `createOrReuseBranch`), y empujarla arriesga revertir en
   * `main` el trabajo de un módulo ajeno al pasar por el squash.
   *
   * Solo mira `apps/(api|web)/src/modules/<otro>/`: es el patrón donde el daño
   * es real y donde no hay falsos positivos. Lo demás que la generación toca
   * legítimamente (schema y migraciones de Prisma, lockfile, package.json) no
   * se restringe aquí.
   */
  private async assertOnlyOwnModule(moduleSlug: string, gitRunner: typeof runGit): Promise<void> {
    const { stdout } = await gitRunner(['diff', '--cached', '--name-only'], this.repoPath);
    const staged = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const otherModule = /^apps\/(?:api|web)\/src\/modules\/([^/]+)\//;
    const foreign = staged.filter((file) => {
      const match = otherModule.exec(file);
      return match !== null && match[1] !== moduleSlug;
    });
    if (foreign.length === 0) return;
    const muestra = foreign.slice(0, 8).join(', ');
    throw new Error(
      `La generación de "${moduleSlug}" toca ${foreign.length} archivo(s) de OTROS módulos y no se empuja: ` +
        `${muestra}${foreign.length > 8 ? ', …' : ''}. ` +
        'Casi siempre significa que la rama nació de un checkout aparcado en la rama de otro módulo: ' +
        'borra la rama en el checkout de generación y re-encola la generación.'
    );
  }

  /**
   * Commitea/empuja la rama y devuelve la URL de la PR. En una REGENERACIÓN
   * incremental (request_change o "complementar") la rama `factory/<slug>` ya
   * suele tener una PR abierta: `gh pr create` fallaría con "already exists"
   * (gap histórico 4). Por eso se REUTILIZA la PR existente (`gh pr view`)
   * antes de intentar crearla — el push ya actualizó su diff.
   *
   * Sin red/token de GitHub (el sandbox de Cowork frecuentemente no la tiene,
   * ver D-016/D-023) falla en silencio: la rama queda commiteada localmente y
   * se documenta como limitación operativa de esta fase, no como bug — el run
   * igual se marca `success` porque el código SÍ se generó y verificó.
   */
  private async tryOpenPullRequest(
    branchName: string,
    moduleSlug: string,
    displayName: string,
    specId: string,
    gitRunner: typeof runGit,
    ghRunner: typeof runGh
  ): Promise<string | null> {
    // `add` y la comprobación de alcance van FUERA del try: que la generación
    // haya tocado otro módulo no es un "no se pudo empujar, seguimos" — es un
    // motivo para no empujar y que el trabajo caiga con esa razón.
    await gitRunner(['add', '-A'], this.repoPath);
    await this.assertOnlyOwnModule(moduleSlug, gitRunner);

    let pushed = false;
    try {
      await gitRunner(['commit', '-m', `[module:${moduleSlug}] Generado por la fábrica (spec ${specId})`], this.repoPath);
      await gitRunner(['push', '-u', 'origin', branchName], this.repoPath);
      pushed = true;
    } catch (error) {
      // "nothing to commit" (regeneración sin cambios netos) o sin red: no
      // abortamos todavía — puede existir ya una PR de una corrida anterior.
      this.logger.warn(
        `No se pudo commitear/empujar la rama ${branchName} (queda como esté localmente): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const existing = await this.findExistingPrUrl(branchName, ghRunner);
    if (existing) {
      this.logger.log(`PR ya existente para ${branchName} reutilizada (gap 4): ${existing}`);
      return existing;
    }
    if (!pushed) return null;

    try {
      const { stdout } = await ghRunner(
        [
          'pr',
          'create',
          '--title',
          `[module:${moduleSlug}] ${displayName}`,
          '--body',
          `Generado por AwkFactory a partir de la spec ${specId}. Ver docs/pipeline/${moduleSlug}/.`,
          '--head',
          branchName
        ],
        this.repoPath
      );
      return stdout.trim().split('\n').pop() ?? null;
    } catch (error) {
      this.logger.warn(
        `No se pudo crear la PR automáticamente (rama ${branchName} queda empujada; abrir a mano y usar "advance"): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  /** URL de la PR ABIERTA para `branchName`, o null si no hay ninguna / `gh` sin red. */
  private async findExistingPrUrl(branchName: string, ghRunner: typeof runGh): Promise<string | null> {
    try {
      const { stdout } = await ghRunner(['pr', 'view', branchName, '--json', 'url,state'], this.repoPath);
      const pr = JSON.parse(stdout) as { url?: string; state?: string };
      // Solo se reutiliza una PR ABIERTA. `gh pr view <rama>` devuelve también la
      // última PR MERGED/CLOSED de esa rama: reutilizarla dejaría los commits de
      // un request_change nuevo sin PR revisable (bug 2026-07-19 — la rama
      // factory/<slug> de un módulo YA mergeado se reabre para el cambio, pero su
      // PR de intake está MERGED). En ese caso devolvemos null → se crea una nueva.
      return pr.state === 'OPEN' && pr.url ? pr.url : null;
    } catch {
      // `gh pr view` sale con error si no hay PR para la rama (o si no hay red).
      return null;
    }
  }

  /** `usage` = consumo del agente cuando lo hubo (D-047, ver AnalysisRunnerService.fail). */
  private async fail(runId: string, projectId: string, message: string, usage?: AgentUsage): Promise<never> {
    await this.prisma.run.update({
      where: { id: runId },
      data: { status: 'error', finishedAt: new Date(), errorMessage: message, ...toUsageFields(usage) }
    });
    await this.projects.transition(projectId, 'error');
    this.logger.error(`Run de generación falló: ${message}`);
    throw new Error(message);
  }
}

const GENERATION_SYSTEM_PROMPT = `Eres el paso de GENERACIÓN del pipeline de AwkFactory (docs/04-integracion-cowork.md, paso 4).
Recibes una spec técnica YA APROBADA (docs/05-gobernanza-seguridad.md: nunca se
genera desde una spec sin gate) y debes rellenar la plantilla de módulo de
docs/02-stack.md:

  apps/api/src/modules/<slug>/   (NestJS: controller, service, DTOs zod, tests)
  apps/web/src/modules/<slug>/   (rutas React sobre packages/ui)

Antes de escribir, lee al menos un módulo ya generado (apps/api/src/modules/
moodle-insights u orientador-ia, y sus equivalentes en apps/web) como
referencia de forma y convenciones — no inventes un patrón nuevo.

Si apps/api/src/modules/<slug>/ ya contiene código de una generación anterior,
esto es una REGENERACIÓN: la rama vuelve a ti porque la revisión pidió cambios.
Ajusta el código existente para cumplir la spec y las notas de los gates (en
especial donde difieran de lo generado); no lo reescribas desde cero si no
hace falta.

El módulo NO hay que registrarlo en ninguna parte (incremento D, D-050): la API
descubre apps/api/src/modules/<slug>/<slug>.module.ts y el shell descubre
apps/web/src/modules/<slug>/index.tsx por el hecho de existir. Respeta esos dos
nombres de archivo y el módulo queda enchufado; no edites app.module.ts ni
registry.ts (no hace falta, y no puedes), y no dejes notas diciendo que el
cableado queda pendiente.

La MIGRACIÓN no la escribes tú (incremento D, D2): al terminar, código nuestro
corre "prisma migrate diff" entre el schema.prisma de origin/main y el que dejes
tú, y escribe apps/api/prisma/migrations/<timestamp>_<slug>/migration.sql. Tu
parte es declarar el modelo en schema.prisma y nada más; no crees carpetas de
migración (no puedes) ni dejes SQL suelto en tu módulo "para que alguien lo
aplique".

EXCEPCIÓN, y es importante: toda constraint que la spec pida y Prisma NO sepa
declarar —índice único PARCIAL (con WHERE), CHECK, exclusion constraint— va en
apps/api/src/modules/<slug>/${EXTRA_SQL_FILENAME}, dentro de tu carpeta. Nuestro
código lo añade al final del migration.sql generado. Un índice único normal NO
sustituye a un único parcial: si la spec dice "un solo X activo por Y", el
@@unique de Prisma prohíbe también los inactivos y cambia la regla de negocio
(pasó de verdad en reserva-salas, D-049, y lo cazó la revisión humana). Escribe
ahí el SQL completo y ejecutable, con un comentario que diga qué regla implementa.

Reglas estrictas:
- SOLO puedes escribir dentro de apps/api/src/modules/<slug>/,
  apps/web/src/modules/<slug>/, y tocar apps/api/prisma/schema.prisma SOLO
  para añadir modelos NUEVOS de ESTE módulo o editar los modelos que YA
  pertenecen a este módulo (p. ej. añadir un campo en un cambio incremental) —
  nunca los modelos de OTROS módulos ni el schema "core".
- No toques core, otros módulos, CI, Dockerfiles ni configuración de la
  plataforma.
- No corras \`git add\`, \`git commit\` ni \`git push\` — de eso se encarga el
  proceso que te invocó una vez que termines.
- Al terminar de escribir código, corre
  \`pnpm exec turbo run build lint typecheck test --filter=@awk/api --filter=@awk/web\`
  (docs/STATUS.md, notas de CI/pnpm 11 — nunca \`pnpm turbo\` sin \`exec\`) y no
  des el trabajo por terminado si algo falla: corrígelo y vuelve a correrlo.`;
