import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { runAgent, type AgentRunResult } from './agent-sdk.client';
import { GatesService } from './gates.service';
import { ProjectsService } from './projects.service';
import { SubmissionsService } from './submissions.service';

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

const CHANGE_ANALYSIS_SYSTEM_PROMPT = `Eres el paso de ANÁLISIS DE CAMBIO del pipeline de AwkFactory
(docs/04-integracion-cowork.md, "request_change": analiza módulo actual +
petición → mini-spec → gates → PR incremental).

A diferencia del análisis de un prototipo nuevo, aquí el módulo YA EXISTE y está
generado/desplegado. Tu insumo es (a) el código vivo del módulo en
apps/api/src/modules/<slug>/ y apps/web/src/modules/<slug>/ — léelo entero antes
de nada — y (b) el texto de la petición de cambio. Produces una MINI-SPEC que
describe SOLO el DELTA: qué cambia funcionalmente y qué cambia técnicamente
(qué archivos/modelos/endpoints/pantallas/roles se tocan), el impacto de
migración si toca schema, y qué se reutiliza. NO re-derives la spec del módulo
entero — céntrate en el cambio.

Debes escribir EXACTAMENTE estos tres archivos, y ningún otro, usando la RUTA
COMPLETA desde la raíz del repo que se te indica en el prompt (empieza con
docs/pipeline/<slug>/change-<n>/, NUNCA una ruta relativa a un subdirectorio
suelto como change-<n>/... ni a la raíz del repo):
- docs/pipeline/<slug>/change-<n>/spec-funcional.md   (el cambio en lenguaje de negocio)
- docs/pipeline/<slug>/change-<n>/spec-tecnica.md     (el cambio a nivel modelos/endpoints/pantallas/roles)
- docs/pipeline/<slug>/change-<n>/meta.json           {"complexityScore": <1-5>, "sensitivityFlags": ["..."], "reuseNotes": "..."}

Aplica los criterios de docs/05-gobernanza-seguridad.md para sensitivityFlags
(si el cambio toca datos personales/RGPD, el schema core, otro módulo, o suma
una dependencia externa → márcalo, fuerza revisión humana) y complexityScore
del CAMBIO (no del módulo). No implementes código todavía — este paso solo
produce la mini-spec para el gate humano.`;

/**
 * Runner de ANÁLISIS (docs/04, paso 2): invoca el Agent SDK headless para
 * que lea el material fuente + el propio repo (antiduplicación) y escriba la
 * spec intermedia como dos archivos markdown + un meta.json, exactamente en
 * el mismo lugar donde ya viven a mano las de `orientador-ia`
 * (docs/pipeline/<slug>/). El runner solo los relee del disco y los guarda
 * como una versión de `Spec`, abre los gates funcional+técnico, y deja el
 * proyecto en `pending_approval`.
 *
 * `runChangeAnalysis` es la variante de request_change (docs/04,
 * "Mantenimiento"): el módulo ya existe, la fuente es el código vivo + una
 * petición de cambio, y la salida es una MINI-spec del delta enlazada a un
 * `ChangeRequest`. Reutiliza el mismo Project (modelo ligero, 2026-07-19): la
 * mini-spec es una versión más de `Spec`, con `changeRequestId` puesto.
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
    private readonly gates: GatesService,
    private readonly submissions: SubmissionsService
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
    // D-036: la fuente de un proyecto cowork_prototype vive en BD
    // (prototype_submissions, la dejó submit_prototype) — se busca ANTES de
    // transicionar: si no hay submission, fallar aquí no deja el proyecto en
    // `analyzing` ni un Run huérfano.
    const submission =
      project.sourceType === 'cowork_prototype' ? await this.submissions.getLatestForProject(projectId) : null;
    // La transición va ANTES de crear el Run: si el estado actual no admite
    // re-análisis (p. ej. pending_approval), fallar aquí no deja un Run
    // huérfano en "running" (bug encontrado en la validación end-to-end del
    // 2026-07-17 — el historial del control plane mostraba "en curso" eterno).
    await this.projects.transition(projectId, 'analyzing');
    const run = await this.prisma.run.create({
      data: { projectId, runType: 'analysis', status: 'running', startedAt: new Date() }
    });

    const specDir = `docs/pipeline/${project.moduleSlug}`;

    // El directorio destino debe existir antes de correr el agente: es el
    // `writableRoot` del guardarraíl y evita que una escritura correcta falle
    // por un padre inexistente (el `change-<n>/` no existe en el primer cambio).
    await mkdir(join(this.repoPath, specDir), { recursive: true });

    // Materialización de la fuente (D-036, reemplaza --source-ref para
    // cowork_prototype): la fuente pasa de BD a disco DENTRO de specDir —
    // ruta ya legible por el agente (cwd = repo) y cubierta por el
    // writableRoot existente. El guardarraíl de generación no cambia: es un
    // guard de ESCRITURA y esto solo añade archivos que el agente lee.
    let sourceDescription = project.sourceRef;
    let additionalDirectories: string[] | undefined;
    if (submission) {
      const sourceDir = join(specDir, 'source');
      await mkdir(join(this.repoPath, sourceDir), { recursive: true });
      await writeFile(join(this.repoPath, sourceDir, 'prototype.html'), submission.source, 'utf-8');
      await writeFile(
        join(this.repoPath, sourceDir, 'prototype.manifest.json'),
        JSON.stringify(submission.manifest, null, 2),
        'utf-8'
      );
      sourceDescription =
        `${sourceDir}/ — prototype.html (el prototipo completo) y prototype.manifest.json ` +
        `(nombre, propósito, actores, entidades con sensibilidad declarada), enviados desde Cowork por ${submission.submittedBy}. ` +
        `Verifica la sensibilidad declarada del manifest y elévala si detectas más (docs/05: nunca rebajarla).`;
    } else {
      additionalDirectories = project.sourceRef.startsWith('/') ? [project.sourceRef] : undefined;
    }

    const prompt = [
      `Proyecto: ${project.displayName} (slug: ${project.moduleSlug}).`,
      `Material fuente: ${sourceDescription}`,
      `Solicitado por: ${project.requestedBy}.`,
      `Escribe la spec en ${specDir}/ tal como se te indicó en las instrucciones del sistema.`
    ].join('\n');

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

    const spec = await this.finalizeSpec({ projectId, runId: run.id, specDir, result });
    this.logger.log(
      `Análisis completo para "${project.moduleSlug}": spec v${spec.version}, gates funcional+técnico abiertos.`
    );
    return spec;
  }

  /**
   * Análisis de cambio (request_change, docs/04). Reutiliza el mismo Project:
   * transiciona a `analyzing` desde el estado asentado en que estaba el módulo
   * (deployed/staging/manager_acceptance), corre el Agent SDK contra el código
   * vivo + la petición, y crea una MINI-spec (nueva versión de Spec, con
   * `changeRequestId`) con gates funcional+técnico frescos.
   */
  async runChangeAnalysis(changeRequestId: string, agentRunner: typeof runAgent = runAgent) {
    const changeRequest = await this.prisma.changeRequest.findUniqueOrThrow({
      where: { id: changeRequestId },
      include: { project: true }
    });
    const project = changeRequest.project;

    await this.projects.transition(project.id, 'analyzing');
    const run = await this.prisma.run.create({
      data: { projectId: project.id, runType: 'analysis', status: 'running', startedAt: new Date() }
    });

    // El directorio del cambio se numera con la versión que tendrá la mini-spec
    // (docs/pipeline/<slug>/change-<n>/). Ningún Spec se crea entre este count
    // y el de finalizeSpec, así que ambos dan el mismo n.
    const nextVersion = (await this.prisma.spec.count({ where: { projectId: project.id } })) + 1;
    const specDir = `docs/pipeline/${project.moduleSlug}/change-${nextVersion}`;
    const latestSpec = await this.prisma.spec.findFirst({
      where: { projectId: project.id },
      orderBy: { version: 'desc' }
    });

    const prompt = [
      `Módulo YA GENERADO a modificar: ${project.moduleSlug} (${project.displayName}).`,
      `El código vive en apps/api/src/modules/${project.moduleSlug}/ y apps/web/src/modules/${project.moduleSlug}/ — léelo antes de nada.`,
      `Petición de cambio (de ${changeRequest.requestedBy}):`,
      changeRequest.requestText,
      `Escribe la mini-spec del cambio en ${specDir}/ tal como indican las instrucciones del sistema.`,
      ...(latestSpec
        ? [
            'Spec vigente del módulo como CONTEXTO (no la repitas; describe solo el DELTA):',
            '--- SPEC TÉCNICA VIGENTE ---',
            latestSpec.technicalContent
          ]
        : [])
    ].join('\n');

    // El `change-<n>/` no existe en el primer cambio: crearlo antes de correr
    // el agente (es el `writableRoot` del guardarraíl).
    await mkdir(join(this.repoPath, specDir), { recursive: true });

    let result: AgentRunResult;
    try {
      result = await agentRunner({
        prompt,
        cwd: this.repoPath,
        systemPrompt: CHANGE_ANALYSIS_SYSTEM_PROMPT,
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        writableRoots: [join(this.repoPath, specDir)]
      });
    } catch (error) {
      return this.fail(run.id, project.id, error instanceof Error ? error.message : String(error));
    }

    if (!result.success) {
      return this.fail(run.id, project.id, result.errorMessage ?? 'El run de análisis de cambio no tuvo éxito.');
    }

    const spec = await this.finalizeSpec({
      projectId: project.id,
      runId: run.id,
      specDir,
      result,
      changeRequestId
    });
    this.logger.log(
      `Análisis de cambio completo para "${project.moduleSlug}": mini-spec v${spec.version}, gates funcional+técnico abiertos.`
    );
    return spec;
  }

  /**
   * Cola común de ambos análisis: relee los tres archivos de spec que dejó el
   * agente, crea la siguiente versión de `Spec` (con `changeRequestId` si es un
   * cambio), abre los gates funcional+técnico, cierra el Run y avanza el
   * proyecto a `spec_ready` → `pending_approval`.
   */
  private async finalizeSpec(opts: {
    projectId: string;
    runId: string;
    specDir: string;
    result: AgentRunResult;
    changeRequestId?: string;
  }) {
    const { projectId, runId, specDir, result, changeRequestId } = opts;

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
        runId,
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
        reuseNotes: meta.reuseNotes,
        changeRequestId
      }
    });

    await this.gates.openGatesForSpec(spec.id, ['functional', 'technical']);

    await this.prisma.run.update({
      where: { id: runId },
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
