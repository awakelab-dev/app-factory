import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { runAgent, type AgentRunResult } from './agent-sdk.client';
import { GatesService } from './gates.service';
import { runGh, runGit } from './git-client';
import { ProjectsService } from './projects.service';
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
}

export interface GenerationRunnerDeps {
  agentRunner?: typeof runAgent;
  runGit?: typeof runGit;
  runGh?: typeof runGh;
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

  private get repoPath(): string {
    const repoPath = process.env.PLATFORM_REPO_PATH;
    if (!repoPath) {
      throw new Error(
        'PLATFORM_REPO_PATH no está configurado — debe apuntar a un checkout local del monorepo app-factory (ver apps/factory/.env.example).'
      );
    }
    return repoPath;
  }

  async runGeneration(specId: string, options: GenerationOptions = {}, deps: GenerationRunnerDeps = {}) {
    const agentRunner = deps.agentRunner ?? runAgent;
    const gitRunner = deps.runGit ?? runGit;
    const ghRunner = deps.runGh ?? runGh;

    const spec = await this.prisma.spec.findUniqueOrThrow({
      where: { id: specId },
      include: { project: true }
    });

    const requiredGates = options.requiredGates ?? DEFAULT_REQUIRED_GATES;
    const approved = await this.gates.areSpecGatesApproved(specId, requiredGates);
    if (!approved) {
      throw new BadRequestException(
        `La spec ${specId} no tiene todos los gates requeridos (${requiredGates.join(', ')}) aprobados — no se puede generar (docs/05-gobernanza-seguridad.md).`
      );
    }

    const project = spec.project;
    const branchName = `factory/${project.moduleSlug}`;

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
    await this.projects.transition(project.id, 'generating');

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
      spec.functionalContent
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
      return this.fail(run.id, project.id, result.errorMessage ?? 'El run de generación no tuvo éxito.');
    }

    const prUrl = await this.tryOpenPullRequest(
      branchName,
      project.moduleSlug,
      project.displayName,
      specId,
      gitRunner,
      ghRunner
    );

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
    }

    this.logger.log(
      `Generación completa para "${project.moduleSlug}" en rama ${branchName}` +
        (prUrl ? ` (PR: ${prUrl}).` : ' (sin PR automática — empujar/abrir a mano, luego usar "advance").')
    );
    return run;
  }

  private async createOrReuseBranch(branchName: string, gitRunner: typeof runGit): Promise<void> {
    try {
      await gitRunner(['checkout', '-b', branchName], this.repoPath);
    } catch (error) {
      if (String(error).includes('already exists')) {
        await gitRunner(['checkout', branchName], this.repoPath);
        return;
      }
      throw error;
    }
  }

  /**
   * Intenta abrir la PR con `gh` CLI. Sin red/token de GitHub (el sandbox de
   * Cowork frecuentemente no la tiene, ver D-016/D-023) falla en silencio:
   * la rama queda commiteada localmente y se documenta como limitación
   * operativa de esta fase, no como bug — el run igual se marca `success`
   * porque el código SÍ se generó y verificó.
   */
  private async tryOpenPullRequest(
    branchName: string,
    moduleSlug: string,
    displayName: string,
    specId: string,
    gitRunner: typeof runGit,
    ghRunner: typeof runGh
  ): Promise<string | null> {
    try {
      await gitRunner(['add', '-A'], this.repoPath);
      await gitRunner(['commit', '-m', `[module:${moduleSlug}] Generado por la fábrica (spec ${specId})`], this.repoPath);
      await gitRunner(['push', '-u', 'origin', branchName], this.repoPath);
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
        `No se pudo abrir la PR automáticamente (rama ${branchName} queda commiteada localmente): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }

  private async fail(runId: string, projectId: string, message: string): Promise<never> {
    await this.prisma.run.update({
      where: { id: runId },
      data: { status: 'error', finishedAt: new Date(), errorMessage: message }
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

Reglas estrictas:
- SOLO puedes escribir dentro de apps/api/src/modules/<slug>/,
  apps/web/src/modules/<slug>/, y añadir modelos NUEVOS al final de
  apps/api/prisma/schema.prisma (nunca editar modelos de otros módulos).
- No toques core, otros módulos, CI, Dockerfiles ni configuración de la
  plataforma.
- No corras \`git add\`, \`git commit\` ni \`git push\` — de eso se encarga el
  proceso que te invocó una vez que termines.
- Al terminar de escribir código, corre
  \`pnpm exec turbo run build lint typecheck test --filter=@awk/api --filter=@awk/web\`
  (docs/STATUS.md, notas de CI/pnpm 11 — nunca \`pnpm turbo\` sin \`exec\`) y no
  des el trabajo por terminado si algo falla: corrígelo y vuelve a correrlo.`;
