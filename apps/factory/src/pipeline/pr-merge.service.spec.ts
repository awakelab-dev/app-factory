import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { GatesService } from './gates.service';
import type { runGh, runGit } from './git-client';
import { PrMergeService } from './pr-merge.service';
import type { ProjectsService } from './projects.service';

/** Checkout de mentira REAL: `assertRunnerEnv` (D-047) comprueba que exista. */
function fakeCheckout(): string {
  const dir = mkdtempSync(join(tmpdir(), 'awkf-merge-'));
  writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages: []\n');
  mkdirSync(join(dir, 'apps/factory'), { recursive: true });
  return dir;
}

function buildService(
  overrides: {
    projectStatus?: string;
    prState?: string;
    prViewError?: Error;
    mergeStateStatus?: string;
    checksError?: Error;
    mergeError?: Error;
    pendingManagerGate?: boolean;
  } = {}
) {
  const prisma = {
    gate: {
      findFirst: vi.fn().mockResolvedValue(overrides.pendingManagerGate ? { id: 'gate-ma' } : null)
    }
  } as unknown as PrismaService;

  const projects = {
    findById: vi.fn().mockResolvedValue({
      id: 'proj-1',
      moduleSlug: 'reserva-salas',
      status: overrides.projectStatus ?? 'pr_review'
    }),
    transition: vi.fn().mockResolvedValue(undefined)
  } as unknown as ProjectsService;

  const gates = { openGatesForSpec: vi.fn().mockResolvedValue([]) } as unknown as GatesService;

  const ghCalls: string[][] = [];
  const gitCalls: string[][] = [];
  const ghRunner = vi.fn(async (args: string[]) => {
    ghCalls.push(args);
    if (args[1] === 'view') {
      if (overrides.prViewError) throw overrides.prViewError;
      return {
        stdout: JSON.stringify({
          url: 'https://github.com/x/y/pull/7',
          state: overrides.prState ?? 'OPEN',
          number: 7,
          mergeStateStatus: overrides.mergeStateStatus ?? 'CLEAN'
        }),
        stderr: ''
      };
    }
    if (args[1] === 'checks' && overrides.checksError) throw overrides.checksError;
    if (args[1] === 'merge' && overrides.mergeError) throw overrides.mergeError;
    return { stdout: '', stderr: '' };
  }) as unknown as typeof runGh;

  const gitRunner = vi.fn(async (args: string[]) => {
    gitCalls.push(args);
    return { stdout: '', stderr: '' };
  }) as unknown as typeof runGit;

  return {
    service: new PrMergeService(prisma, projects, gates),
    deps: { runGh: ghRunner, runGit: gitRunner },
    prisma,
    projects,
    gates,
    ghCalls,
    gitCalls
  };
}

describe('PrMergeService.runMerge — PR con conflictos (panel-prioridades, 2026-08-27)', () => {
  beforeEach(() => {
    process.env.PLATFORM_REPO_PATH = fakeCheckout();
    process.env.ANTHROPIC_API_KEY = 'test';
  });

  it('una PR DIRTY falla ANTES de esperar checks, y el motivo habla de conflictos y no de checks', async () => {
    const { service, deps, ghCalls, projects } = buildService({ mergeStateStatus: 'DIRTY' });

    // GitHub no puede construir refs/pull/N/merge en una PR conflictiva, así
    // que los workflows de pull_request no existen y `gh pr checks` respondía
    // "no checks reported" — un error que apuntaba al sitio equivocado.
    await expect(service.runMerge('proj-1', 'spec-1', deps)).rejects.toThrow(/CONFLICTOS con main/);
    expect(ghCalls.some((args) => args[1] === 'checks')).toBe(false);
    expect(ghCalls.some((args) => args[1] === 'merge')).toBe(false);
    expect(projects.transition).not.toHaveBeenCalled();
  });

  it('pide mergeStateStatus en el gh pr view (si no, no hay nada que comprobar)', async () => {
    const { service, deps, ghCalls } = buildService();

    await service.runMerge('proj-1', 'spec-1', deps);

    const view = ghCalls.find((args) => args[1] === 'view');
    expect(view?.join(' ')).toContain('mergeStateStatus');
  });

  it('mergeStateStatus UNKNOWN (GitHub aún calculando) NO bloquea: solo DIRTY es un no rotundo', async () => {
    const { service, deps, ghCalls } = buildService({ mergeStateStatus: 'UNKNOWN' });

    await service.runMerge('proj-1', 'spec-1', deps);

    expect(ghCalls.some((args) => args[1] === 'merge')).toBe(true);
  });
});

describe('PrMergeService.runMerge', () => {
  beforeEach(() => {
    // `assertRunnerEnv` corre en la primera línea, como en todos los runners.
    process.env.PLATFORM_REPO_PATH = fakeCheckout();
    process.env.ANTHROPIC_API_KEY = 'test';
  });

  afterEach(() => {
    delete process.env.FACTORY_PR_CHECKS_TIMEOUT_MS;
  });

  it('espera los checks, mergea con squash y SOLO ENTONCES lleva el proyecto a staging', async () => {
    const { service, deps, projects, ghCalls } = buildService();

    const result = await service.runMerge('proj-1', 'spec-9', deps);

    const checks = ghCalls.find((args) => args[1] === 'checks');
    expect(checks).toEqual(['pr', 'checks', 'factory/reserva-salas', '--watch', '--fail-fast', '--interval', '30']);
    expect(ghCalls).toContainEqual(['pr', 'merge', 'factory/reserva-salas', '--squash', '--delete-branch']);
    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'staging');
    expect(result).toEqual({ prUrl: 'https://github.com/x/y/pull/7', alreadyMerged: false });
  });

  it('el orden importa: no transiciona si el merge falla (el gate dejaba de mentir, D-049)', async () => {
    const { service, deps, projects } = buildService({ mergeError: new Error('merge conflict') });

    await expect(service.runMerge('proj-1', 'spec-9', deps)).rejects.toThrow(/merge conflict/);
    expect(projects.transition).not.toHaveBeenCalled();
  });

  it('si la CI está en rojo no mergea nada', async () => {
    const { service, deps, ghCalls, projects } = buildService({ checksError: new Error('1 check failing') });

    await expect(service.runMerge('proj-1', 'spec-9', deps)).rejects.toThrow(/check failing/);
    expect(ghCalls.some((args) => args[1] === 'merge')).toBe(false);
    expect(projects.transition).not.toHaveBeenCalled();
  });

  it('abre el gate manager_acceptance DESPUÉS del merge (antes no hay staging que validar)', async () => {
    const { service, deps, gates } = buildService();

    await service.runMerge('proj-1', 'spec-9', deps);

    expect(gates.openGatesForSpec).toHaveBeenCalledWith('spec-9', ['manager_acceptance']);
  });

  it('un reintento sobre una PR ya MERGED no vuelve a mergear ni duplica el gate', async () => {
    const { service, deps, gates, ghCalls, projects } = buildService({
      prState: 'MERGED',
      projectStatus: 'staging',
      pendingManagerGate: true
    });

    const result = await service.runMerge('proj-1', 'spec-9', deps);

    expect(result.alreadyMerged).toBe(true);
    expect(ghCalls.some((args) => args[1] === 'merge')).toBe(false);
    // `staging → staging` no existe en la máquina de estados: re-transicionar
    // convertiría un reintento idempotente en un error.
    expect(projects.transition).not.toHaveBeenCalled();
    expect(gates.openGatesForSpec).not.toHaveBeenCalled();
  });

  it('una PR CLOSED sin mergear es fatal: no se lleva el proyecto a staging por decreto', async () => {
    const { service, deps, projects } = buildService({ prState: 'CLOSED' });

    await expect(service.runMerge('proj-1', 'spec-9', deps)).rejects.toThrow(/CLOSED/);
    expect(projects.transition).not.toHaveBeenCalled();
  });

  it('sin PR para la rama da un error accionable, no un merge a ciegas', async () => {
    const { service, deps } = buildService({
      prViewError: new Error('gh pr view falló (código 1): no pull requests found for branch "factory/reserva-salas"')
    });

    await expect(service.runMerge('proj-1', 'spec-9', deps)).rejects.toThrow(/No hay ninguna PR/);
  });

  it('un fallo de RED al consultar la PR se propaga tal cual (para que se clasifique como reintentable)', async () => {
    const { service, deps } = buildService({ prViewError: new Error('gh pr view falló: fetch failed') });

    // Si esto se tradujera a "no hay PR", el clasificador lo daría por fatal y
    // un corte de red dejaría la PR aprobada sin mergear para siempre.
    await expect(service.runMerge('proj-1', 'spec-9', deps)).rejects.toThrow(/fetch failed/);
  });

  it('tras mergear devuelve el checkout a origin/main y borra la rama local (no se acumulan ramas viejas)', async () => {
    const { service, deps, gitCalls } = buildService();

    await service.runMerge('proj-1', 'spec-9', deps);

    expect(gitCalls).toContainEqual(['reset', '--hard', 'origin/main']);
    expect(gitCalls).toContainEqual(['branch', '-D', 'factory/reserva-salas']);
  });

  it('si la limpieza del checkout falla, el trabajo NO cae (la PR ya está en main)', async () => {
    const { service, prisma, projects, gates } = buildService();
    const failingGit = vi.fn().mockRejectedValue(new Error('checkout ocupado')) as unknown as typeof runGit;
    const okGh = vi.fn(async (args: string[]) => ({
      stdout: args[1] === 'view' ? JSON.stringify({ url: 'https://pr/7', state: 'OPEN' }) : '',
      stderr: ''
    })) as unknown as typeof runGh;
    const service2 = new PrMergeService(prisma, projects, gates);

    await expect(service2.runMerge('proj-1', 'spec-9', { runGit: failingGit, runGh: okGh })).resolves.toMatchObject({
      alreadyMerged: false
    });
    void service;
  });
});
