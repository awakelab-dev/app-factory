import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { runAgent, type AgentRunResult } from './agent-sdk.client';
import { GatesService } from './gates.service';
import { ProjectsService } from './projects.service';

const DEFAULT_MODEL = 'claude-sonnet-5';

const ANALYSIS_SYSTEM_PROMPT = `Eres el paso de ANÁLISIS del pipeline de AwkFactory (docs/04-integracion-cowork.md, paso 2).
Tu única tarea es producir la spec intermedia de un prototipo/encargo, en el mismo
formato y nivel de detalle que los ejemplos ya aprobados en
docs/pipeline/orientador-ia/spec-funcional.md y spec-tecnica.md — léelos primero
como referencia de tono y estructura, NO los copies literalmente.

Debes escribir EXACTAMENTE estos tres archivos, y ningún otro:
- docs/pipeline/<slug>/spec-funcional.md   (lenguaje de negocio, para quien encarga)
- docs/pipeline/<slug>/spec-tecnica.md     (modelos, endpoints, pantallas, roles — docs/02-stack.md)
- docs/pipeline/<slug>/meta.json           con la forma exacta
  {"complexityScore": <1-5>, "sensitivityFlags": ["..."], "reuseNotes": "..."}

Antes de escribir, explora apps/api/src/modules/ y apps/web/src/modules/ para
detectar qué ya resuelve el core o un módulo existente (antiduplicación,
docs/04-integracion-cowork.md, "list_modules") y documenta eso en reuseNotes.
Aplica los criterios de docs/05-gobernanza-seguridad.md para sensitivityFlags
(datos personales/RGPD, dependencias externas nuevas, migraciones a core,
primer módulo de un tipo/cliente) y complexityScore. No implementes código
todavía — este paso solo produce la spec para el gate humano.`;

/**
 * Runner de ANÁLISIS (docs/04, paso 2): invoca el Agent SDK headless para
 * que lea el material fuente + el propio repo (antiduplicación) y escriba la
 * spec intermedia como dos archivos markdown + un meta.json, exactamente en
 * el mismo lugar donde ya viven a mano las de `orientador-ia`
 * (docs/pipeline/<slug>/). El runner solo los relee del disco y los guarda
 * como una versión de `Spec`, abre los gates funcional+técnico, y deja el
 * proyecto en `pending_approval`.
 *
 * También sirve para REVISAR una spec ("complementar", docs/05): si el
 * proyecto viene de `changes_requested` → `spec_ready`, correr `analyze` de
 * nuevo crea la siguiente versión con gates frescos — un dev edita el
 * material fuente/instrucciones entre una corrida y otra, no el código.
 */
@Injectable()
export class AnalysisRunnerService {
  private readonly logger = new Logger(AnalysisRunnerService.name);

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

  async runAnalysis(projectId: string, agentRunner: typeof runAgent = runAgent) {
    const project = await this.projects.findById(projectId);
    const run = await this.prisma.run.create({
      data: { projectId, runType: 'analysis', status: 'running', startedAt: new Date() }
    });
    await this.projects.transition(projectId, 'analyzing');

    const specDir = `docs/pipeline/${project.moduleSlug}`;
    const prompt = [
      `Proyecto: ${project.displayName} (slug: ${project.moduleSlug}).`,
      `Material fuente: ${project.sourceRef}`,
      `Solicitado por: ${project.requestedBy}.`,
      `Escribe la spec en ${specDir}/ tal como se te indicó en las instrucciones del sistema.`
    ].join('\n');

    const additionalDirectories = project.sourceRef.startsWith('/') ? [project.sourceRef] : undefined;

    let result: AgentRunResult;
    try {
      result = await agentRunner({
        prompt,
        cwd: this.repoPath,
        additionalDirectories,
        systemPrompt: ANALYSIS_SYSTEM_PROMPT,
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        writableRoots: [join(this.repoPath, specDir)]
      });
    } catch (error) {
      return this.fail(run.id, projectId, error instanceof Error ? error.message : String(error));
    }

    if (!result.success) {
      return this.fail(run.id, projectId, result.errorMessage ?? 'El run de análisis no tuvo éxito.');
    }

    let functionalContent: string;
    let technicalContent: string;
    let meta: { complexityScore?: number; sensitivityFlags?: string[]; reuseNotes?: string } = {};
    try {
      [functionalContent, technicalContent] = await Promise.all([
        readFile(join(this.repoPath, specDir, 'spec-funcional.md'), 'utf-8'),
        readFile(join(this.repoPath, specDir, 'spec-tecnica.md'), 'utf-8')
      ]);
      const metaRaw = await readFile(join(this.repoPath, specDir, 'meta.json'), 'utf-8').catch(() => '{}');
      meta = JSON.parse(metaRaw) as typeof meta;
    } catch (error) {
      return this.fail(
        run.id,
        projectId,
        `El agente terminó pero no dejó los archivos de spec esperados en ${specDir}/: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const nextVersion = (await this.prisma.spec.count({ where: { projectId } })) + 1;
    const spec = await this.prisma.spec.create({
      data: {
        projectId,
        version: nextVersion,
        functionalContent,
        technicalContent,
        complexityScore: meta.complexityScore,
        sensitivityFlags: meta.sensitivityFlags ?? [],
        reuseNotes: meta.reuseNotes
      }
    });

    await this.gates.openGatesForSpec(spec.id, ['functional', 'technical']);

    await this.prisma.run.update({
      where: { id: run.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        specId: spec.id,
        agentSessionId: result.sessionId,
        outputSummary: result.resultText,
        costUsd: result.costUsd,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens
      }
    });

    await this.projects.transition(projectId, 'spec_ready');
    await this.projects.transition(projectId, 'pending_approval');

    this.logger.log(`Análisis completo para "${project.moduleSlug}": spec v${nextVersion}, gates funcional+técnico abiertos.`);
    return spec;
  }

  private async fail(runId: string, projectId: string, message: string): Promise<never> {
    await this.prisma.run.update({
      where: { id: runId },
      data: { status: 'error', finishedAt: new Date(), errorMessage: message }
    });
    await this.projects.transition(projectId, 'error');
    this.logger.error(`Run de análisis falló: ${message}`);
    throw new Error(message);
  }
}
