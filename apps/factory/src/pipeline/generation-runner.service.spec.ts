import { BadRequestException } from '@nestjs/common';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { AgentRunResult } from './agent-sdk.client';
import type { GatesService } from './gates.service';
import { GenerationRunnerService } from './generation-runner.service';
import type { GitCommandResult } from './git-client';
import type { ProjectsService } from './projects.service';

const project = { id: 'proj-1', moduleSlug: 'demo-modulo', displayName: 'Demo' };
const spec = { id: 'spec-1', technicalContent: '# técnica', functionalContent: '# funcional', project };

const successResult: AgentRunResult = {
  success: true,
  resultText: 'listo',
  sessionId: 'sess-1',
  costUsd: 0.02,
  inputTokens: 500,
  outputTokens: 800,
  turns: 10
};

const okGit: GitCommandResult = { stdout: '', stderr: '' };

/** Checkout de mentira REAL: `assertRunnerEnv` (D-047) comprueba que exista. */
function fakeCheckout({ conPrisma = true } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'awkf-repo-'));
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages: []\n');
  mkdirSync(join(dir, 'apps/factory'), { recursive: true });
  if (conPrisma) {
    // D2: `assertPrismaCli` exige el CLI del checkout antes de gastar agente.
    mkdirSync(join(dir, 'apps/api/node_modules/.bin'), { recursive: true });
    writeFileSync(join(dir, 'apps/api/node_modules/.bin/prisma'), '#!/bin/sh\nexit 0\n');
  }
  return dir;
}

/**
 * La generación de la migración (D2) se inyecta en TODOS los tests: aquí se
 * ejercita el runner, no el generador — ese tiene su propio archivo
 * (migration-generator.spec.ts) y correrlo de verdad implicaría un repo git.
 */
const sinMigracion = () => vi.fn().mockResolvedValue(null);

let repo = '';

function buildService(
  overrides: {
    gatesApproved?: boolean;
    spec?: typeof spec | null;
    projectByThatId?: { id: string; moduleSlug: string } | null;
    specGates?: Array<{ gateType: string; reviewer: string; decisionNotes: string | null }>;
  } = {}
) {
  const prisma = {
    spec: {
      findUnique: vi.fn().mockResolvedValue(overrides.spec === undefined ? spec : overrides.spec)
    },
    project: {
      findUnique: vi.fn().mockResolvedValue(overrides.projectByThatId ?? null)
    },
    gate: {
      findMany: vi.fn().mockResolvedValue(overrides.specGates ?? [])
    },
    run: {
      create: vi.fn().mockResolvedValue({ id: 'run-1' }),
      update: vi.fn().mockResolvedValue(undefined),
      // Gap 5: runGeneration relee el run antes de devolverlo (estado final).
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'run-1', status: 'success' })
    }
  } as unknown as PrismaService;

  const projects = { transition: vi.fn().mockResolvedValue(undefined) } as unknown as ProjectsService;

  const gates = {
    areSpecGatesApproved: vi.fn().mockResolvedValue(overrides.gatesApproved ?? true),
    openGatesForSpec: vi.fn().mockResolvedValue(undefined)
  } as unknown as GatesService;

  return { service: new GenerationRunnerService(prisma, projects, gates), prisma, projects, gates };
}

describe('GenerationRunnerService.runGeneration', () => {
  beforeEach(() => {
    repo = fakeCheckout();
    process.env.PLATFORM_REPO_PATH = repo;
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  it('rechaza generar si faltan gates por aprobar, sin crear ningún run', async () => {
    const { service, prisma, gates } = buildService({ gatesApproved: false });

    await expect(service.runGeneration('spec-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(gates.areSpecGatesApproved).toHaveBeenCalledWith('spec-1', ['functional', 'technical']);
    expect(prisma.run.create).not.toHaveBeenCalled();
  });

  it('da un error accionable (no el crudo de Prisma) si le pasan un projectId en vez de un specId', async () => {
    const { service, prisma } = buildService({
      spec: null,
      projectByThatId: { id: 'proj-1', moduleSlug: 'demo-modulo' }
    });

    await expect(service.runGeneration('proj-1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.runGeneration('proj-1')).rejects.toThrow(/es un projectId, no un specId/);
    await expect(service.runGeneration('proj-1')).rejects.toThrow(/status proj-1/);
    expect(prisma.run.create).not.toHaveBeenCalled();
  });

  it('da un error accionable si el id no corresponde ni a spec ni a proyecto', async () => {
    const { service, prisma } = buildService({ spec: null, projectByThatId: null });

    await expect(service.runGeneration('nope')).rejects.toThrow(/No existe ninguna spec con id "nope"/);
    expect(prisma.run.create).not.toHaveBeenCalled();
  });

  it('crea la rama, corre el agente con las carpetas del módulo como único alcance de escritura, y avanza a pr_review cuando hay PR', async () => {
    const { service, prisma, projects } = buildService();
    const agentRunner = vi.fn().mockResolvedValue(successResult);
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockImplementation((args: string[]) =>
      Promise.resolve({
        stdout: args.includes('view')
          ? '{"url":"https://github.com/awakelab-dev/app-factory/pull/42","state":"OPEN"}\n'
          : 'https://github.com/awakelab-dev/app-factory/pull/42\n',
        stderr: ''
      })
    );

    const run = await service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh, generateMigration: sinMigracion() });

    expect(runGit).toHaveBeenCalledWith(['checkout', '-b', 'factory/demo-modulo'], repo);
    expect(agentRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: repo,
        writableRoots: [
          `${repo}/apps/api/src/modules/demo-modulo`,
          `${repo}/apps/web/src/modules/demo-modulo`,
          `${repo}/apps/api/prisma/schema.prisma`
        ]
      })
    );
    expect(runGit).toHaveBeenCalledWith(['push', '-u', 'origin', 'factory/demo-modulo'], repo);
    expect(prisma.run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'success', prUrl: 'https://github.com/awakelab-dev/app-factory/pull/42' })
      })
    );
    expect(projects.transition).toHaveBeenNthCalledWith(1, 'proj-1', 'generating');
    expect(projects.transition).toHaveBeenNthCalledWith(2, 'proj-1', 'verifying');
    expect(projects.transition).toHaveBeenNthCalledWith(3, 'proj-1', 'pr_review');
    expect(run).toMatchObject({ id: 'run-1' });
  });

  it('si no hay red/gh, el código queda commiteado localmente y el proyecto SOLO avanza a verifying (sin pr_review ni gate)', async () => {
    const { service, projects, gates } = buildService();
    const agentRunner = vi.fn().mockResolvedValue(successResult);
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockRejectedValue(new Error('gh: command not found'));

    await service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh, generateMigration: sinMigracion() });

    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'verifying');
    expect(projects.transition).not.toHaveBeenCalledWith('proj-1', 'pr_review');
    expect(gates.openGatesForSpec).not.toHaveBeenCalled();
  });

  it('reutiliza la PR existente en una regeneración (gap 4): usa gh pr view y no rompe aunque create daría "already exists"', async () => {
    const { service, prisma } = buildService();
    const agentRunner = vi.fn().mockResolvedValue(successResult);
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockImplementation((args: string[]) =>
      args.includes('view')
        ? Promise.resolve({
            stdout: '{"url":"https://github.com/awakelab-dev/app-factory/pull/7","state":"OPEN"}\n',
            stderr: ''
          })
        : Promise.reject(new Error('a pull request for branch "factory/demo-modulo" already exists'))
    );

    await service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh, generateMigration: sinMigracion() });

    expect(runGh).toHaveBeenCalledWith(['pr', 'view', 'factory/demo-modulo', '--json', 'url,state'], repo);
    expect(runGh).not.toHaveBeenCalledWith(expect.arrayContaining(['pr', 'create']), repo);
    expect(prisma.run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ prUrl: 'https://github.com/awakelab-dev/app-factory/pull/7' })
      })
    );
  });

  it('NO reutiliza una PR MERGED/CLOSED: crea una nueva (regresión request_change sobre módulo ya mergeado, 2026-07-19)', async () => {
    const { service, prisma } = buildService();
    const agentRunner = vi.fn().mockResolvedValue(successResult);
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockImplementation((args: string[]) =>
      args.includes('view')
        ? Promise.resolve({
            stdout: '{"url":"https://github.com/awakelab-dev/app-factory/pull/2","state":"MERGED"}\n',
            stderr: ''
          })
        : Promise.resolve({ stdout: 'https://github.com/awakelab-dev/app-factory/pull/3\n', stderr: '' })
    );

    await service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh, generateMigration: sinMigracion() });

    expect(runGh).toHaveBeenCalledWith(expect.arrayContaining(['pr', 'create']), repo);
    expect(prisma.run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ prUrl: 'https://github.com/awakelab-dev/app-factory/pull/3' })
      })
    );
  });

  it('abre el gate pr_review de primera clase cuando la generación deja una PR', async () => {
    const { service, gates } = buildService();
    const agentRunner = vi.fn().mockResolvedValue(successResult);
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockImplementation((args: string[]) =>
      Promise.resolve({
        stdout: args.includes('view')
          ? '{"url":"https://github.com/awakelab-dev/app-factory/pull/9","state":"OPEN"}\n'
          : 'https://github.com/awakelab-dev/app-factory/pull/9\n',
        stderr: ''
      })
    );

    await service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh, generateMigration: sinMigracion() });

    expect(gates.openGatesForSpec).toHaveBeenCalledWith('spec-1', ['pr_review']);
  });

  it('incluye las decisionNotes de los gates aprobados en el prompt como instrucciones vinculantes', async () => {
    // Lección del primer encargo real (gestor-proyectos, 2026-07-19): la
    // precisión "reasignar es SOLO admin" vivía en las notas del gate técnico
    // y el agente nunca la vio — el prompt solo llevaba las specs.
    const { service, prisma } = buildService({
      specGates: [
        { gateType: 'functional', reviewer: 'leo@awakelab.dev', decisionNotes: 'Arrancar vacío, sin datos de ejemplo.' },
        { gateType: 'technical', reviewer: 'leo@awakelab.dev', decisionNotes: 'Cambiar el asignado es SOLO admin.' }
      ]
    });
    const agentRunner = vi.fn().mockResolvedValue(successResult);
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockResolvedValue(okGit);

    await service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh, generateMigration: sinMigracion() });

    expect(prisma.gate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { specId: 'spec-1', status: 'approved' } })
    );
    const prompt: string = agentRunner.mock.calls[0]?.[0]?.prompt;
    expect(prompt).toContain('NOTAS DE LOS GATES APROBADOS');
    expect(prompt).toContain('[gate technical — leo@awakelab.dev]');
    expect(prompt).toContain('Cambiar el asignado es SOLO admin.');
    expect(prompt).toContain('Arrancar vacío, sin datos de ejemplo.');
  });

  it('omite el bloque de notas si los gates aprobados no traen decisionNotes', async () => {
    const { service } = buildService({
      specGates: [{ gateType: 'functional', reviewer: 'leo@awakelab.dev', decisionNotes: null }]
    });
    const agentRunner = vi.fn().mockResolvedValue(successResult);
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockResolvedValue(okGit);

    await service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh, generateMigration: sinMigracion() });

    expect(agentRunner.mock.calls[0]?.[0]?.prompt).not.toContain('NOTAS DE LOS GATES APROBADOS');
  });

  it('nunca permite que el bash del agente haga git push/commit o sudo', async () => {
    const { service } = buildService();
    const agentRunner = vi.fn().mockResolvedValue(successResult);
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockResolvedValue(okGit);

    await service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh, generateMigration: sinMigracion() });

    const call = agentRunner.mock.calls[0]?.[0];
    expect(call.isBashCommandAllowed('git push origin main')).toBe(false);
    expect(call.isBashCommandAllowed('sudo rm -rf /')).toBe(false);
    expect(call.isBashCommandAllowed('pnpm exec turbo run test')).toBe(true);
  });

  it('marca el run y el proyecto en error si el agente no tiene éxito', async () => {
    const { service, prisma, projects } = buildService();
    const agentRunner = vi.fn().mockResolvedValue({ ...successResult, success: false, errorMessage: 'build roto' });
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockResolvedValue(okGit);

    await expect(service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh, generateMigration: sinMigracion() })).rejects.toThrow('build roto');

    expect(prisma.run.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'error', errorMessage: 'build roto' }) })
    );
    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'error');
  });

  // Hueco de instrumentación (a) de D-046: la generación que se cayó a los 23
  // minutos por un corte de red no dejó rastro de coste en ninguna métrica.
  it('un run de generación fallido registra el coste y los tokens consumidos (D-046)', async () => {
    const { service, prisma } = buildService();
    const agentRunner = vi.fn().mockResolvedValue({
      ...successResult,
      success: false,
      errorMessage: 'Connection closed mid-response',
      partial: true
    });
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockResolvedValue(okGit);

    await expect(service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh, generateMigration: sinMigracion() })).rejects.toThrow(
      'Connection closed mid-response'
    );

    expect(prisma.run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'error', costUsd: 0.02, inputTokens: 500, outputTokens: 800 })
      })
    );
  });

  // ---- Incremento D, bloque 3a: la migración se genera dentro del run ----

  it('genera la migración con el checkout y el slug del proyecto, ANTES del commit', async () => {
    const { service } = buildService();
    const orden: string[] = [];
    const agentRunner = vi.fn().mockResolvedValue(successResult);
    const runGit = vi.fn().mockImplementation((args: string[]) => {
      orden.push(`git:${args[0]}`);
      return Promise.resolve(okGit);
    });
    const runGh = vi.fn().mockResolvedValue(okGit);
    const generateMigration = vi.fn().mockImplementation(() => {
      orden.push('migracion');
      return Promise.resolve({
        dirName: '20260818224500_demo_modulo',
        sql: 'CREATE SCHEMA "demo";',
        includesExtraSql: true,
        removedDirs: [],
        baseSha: 'abc1234'
      });
    });

    await service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh, generateMigration });

    expect(generateMigration).toHaveBeenCalledWith(
      { repoPath: repo, moduleSlug: 'demo-modulo' },
      expect.objectContaining({ runGit, runPrisma: expect.any(Function) })
    );
    // El .sql tiene que entrar en el MISMO commit que el código, o la PR
    // llegaría al gate técnico sin nada que revisar.
    expect(orden.indexOf('migracion')).toBeLessThan(orden.indexOf('git:add'));
  });

  it('si la migración no se puede escribir, el run falla (con su coste) y NO se abre PR', async () => {
    // Una PR con el modelo en schema.prisma pero sin su .sql devolvería el
    // paso manual que D2 elimina — y el 500 silencioso en staging.
    const { service, prisma, projects } = buildService();
    const agentRunner = vi.fn().mockResolvedValue(successResult);
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockResolvedValue(okGit);
    const generateMigration = vi.fn().mockRejectedValue(new Error('prisma migrate diff falló: schema inválido'));

    await expect(service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh, generateMigration })).rejects.toThrow(
      /no se pudo escribir la migración de "demo-modulo"/
    );

    expect(prisma.run.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'error', costUsd: 0.02, inputTokens: 500, outputTokens: 800 })
      })
    );
    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'error');
    expect(runGh).not.toHaveBeenCalled();
  });

  it('un módulo que no toca el esquema (migración null) sigue adelante con normalidad', async () => {
    const { service, projects } = buildService();
    const agentRunner = vi.fn().mockResolvedValue(successResult);
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockResolvedValue(okGit);

    await service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh, generateMigration: sinMigracion() });

    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'verifying');
  });

  it('un checkout sin el CLI de Prisma falla ANTES de transicionar y sin gastar agente (regla de D-047)', async () => {
    process.env.PLATFORM_REPO_PATH = fakeCheckout({ conPrisma: false });
    const { service, prisma, projects } = buildService();
    const agentRunner = vi.fn().mockResolvedValue(successResult);

    await expect(service.runGeneration('spec-1', {}, { agentRunner })).rejects.toThrow(/CLI de Prisma/);
    expect(agentRunner).not.toHaveBeenCalled();
    expect(projects.transition).not.toHaveBeenCalled();
    expect(prisma.run.create).not.toHaveBeenCalled();
  });

  it('el system prompt manda las constraints que Prisma no expresa a migration.extra.sql', async () => {
    const { service } = buildService();
    const agentRunner = vi.fn().mockResolvedValue(successResult);
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockResolvedValue(okGit);

    await service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh, generateMigration: sinMigracion() });

    const systemPrompt: string = agentRunner.mock.calls[0]?.[0]?.systemPrompt;
    expect(systemPrompt).toContain('migration.extra.sql');
    expect(systemPrompt).toContain('PARCIAL');
    expect(systemPrompt).toContain('D-049');
  });

  it('sin PLATFORM_REPO_PATH falla ANTES de transicionar y sin crear Run (D-046 bug 1)', async () => {
    delete process.env.PLATFORM_REPO_PATH;
    const { service, prisma, projects } = buildService();

    await expect(service.runGeneration('spec-1')).rejects.toThrow(/PLATFORM_REPO_PATH/);
    expect(projects.transition).not.toHaveBeenCalled();
    expect(prisma.run.create).not.toHaveBeenCalled();
  });
});
