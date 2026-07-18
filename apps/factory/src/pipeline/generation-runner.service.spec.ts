import { BadRequestException } from '@nestjs/common';
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

function buildService(
  overrides: {
    gatesApproved?: boolean;
    spec?: typeof spec | null;
    projectByThatId?: { id: string; moduleSlug: string } | null;
  } = {}
) {
  const prisma = {
    spec: {
      findUnique: vi.fn().mockResolvedValue(overrides.spec === undefined ? spec : overrides.spec)
    },
    project: {
      findUnique: vi.fn().mockResolvedValue(overrides.projectByThatId ?? null)
    },
    run: {
      create: vi.fn().mockResolvedValue({ id: 'run-1' }),
      update: vi.fn().mockResolvedValue(undefined)
    }
  } as unknown as PrismaService;

  const projects = { transition: vi.fn().mockResolvedValue(undefined) } as unknown as ProjectsService;

  const gates = {
    areSpecGatesApproved: vi.fn().mockResolvedValue(overrides.gatesApproved ?? true)
  } as unknown as GatesService;

  return { service: new GenerationRunnerService(prisma, projects, gates), prisma, projects, gates };
}

describe('GenerationRunnerService.runGeneration', () => {
  beforeEach(() => {
    process.env.PLATFORM_REPO_PATH = '/repo';
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
    const runGh = vi.fn().mockResolvedValue({ stdout: 'https://github.com/awakelab-dev/app-factory/pull/42\n', stderr: '' });

    const run = await service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh });

    expect(runGit).toHaveBeenCalledWith(['checkout', '-b', 'factory/demo-modulo'], '/repo');
    expect(agentRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        cwd: '/repo',
        writableRoots: [
          '/repo/apps/api/src/modules/demo-modulo',
          '/repo/apps/web/src/modules/demo-modulo',
          '/repo/apps/api/prisma/schema.prisma'
        ]
      })
    );
    expect(runGit).toHaveBeenCalledWith(['push', '-u', 'origin', 'factory/demo-modulo'], '/repo');
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

  it('si no hay red/gh, el código queda commiteado localmente y el proyecto SOLO avanza a verifying (sin pr_review)', async () => {
    const { service, projects } = buildService();
    const agentRunner = vi.fn().mockResolvedValue(successResult);
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockRejectedValue(new Error('gh: command not found'));

    await service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh });

    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'verifying');
    expect(projects.transition).not.toHaveBeenCalledWith('proj-1', 'pr_review');
  });

  it('nunca permite que el bash del agente haga git push/commit o sudo', async () => {
    const { service } = buildService();
    const agentRunner = vi.fn().mockResolvedValue(successResult);
    const runGit = vi.fn().mockResolvedValue(okGit);
    const runGh = vi.fn().mockResolvedValue(okGit);

    await service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh });

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

    await expect(service.runGeneration('spec-1', {}, { agentRunner, runGit, runGh })).rejects.toThrow('build roto');

    expect(prisma.run.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'error', errorMessage: 'build roto' }) })
    );
    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'error');
  });
});
