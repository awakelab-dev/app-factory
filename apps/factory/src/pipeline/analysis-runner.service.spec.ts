import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { AgentRunResult } from './agent-sdk.client';
import { AnalysisRunnerService } from './analysis-runner.service';
import type { GatesService } from './gates.service';
import type { ProjectsService } from './projects.service';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}));

const readFileMock = vi.mocked(readFile);

const project = {
  id: 'proj-1',
  moduleSlug: 'demo-modulo',
  displayName: 'Demo',
  sourceRef: '/tmp/proto',
  requestedBy: 'leonardo.barreto@awakelab.dev'
};

const successResult: AgentRunResult = {
  success: true,
  resultText: 'listo',
  sessionId: 'sess-1',
  costUsd: 0.01,
  inputTokens: 100,
  outputTokens: 200,
  turns: 3
};

function buildService() {
  const prisma = {
    run: {
      create: vi.fn().mockResolvedValue({ id: 'run-1' }),
      update: vi.fn().mockResolvedValue(undefined)
    },
    spec: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'spec-1', ...data })
      )
    }
  } as unknown as PrismaService;

  const projects = {
    findById: vi.fn().mockResolvedValue(project),
    transition: vi.fn().mockResolvedValue(undefined)
  } as unknown as ProjectsService;

  const gates = {
    openGatesForSpec: vi.fn().mockResolvedValue(undefined)
  } as unknown as GatesService;

  return { service: new AnalysisRunnerService(prisma, projects, gates), prisma, projects, gates };
}

describe('AnalysisRunnerService.runAnalysis', () => {
  beforeEach(() => {
    process.env.PLATFORM_REPO_PATH = '/repo';
    readFileMock.mockReset();
  });

  it('crea la spec (v1), abre los gates y deja el proyecto en pending_approval', async () => {
    const { service, prisma, projects, gates } = buildService();
    readFileMock
      .mockResolvedValueOnce('# spec funcional')
      .mockResolvedValueOnce('# spec técnica')
      .mockResolvedValueOnce(JSON.stringify({ complexityScore: 3, sensitivityFlags: ['rgpd'], reuseNotes: 'nada reutilizable' }));
    const agentRunner = vi.fn().mockResolvedValue(successResult);

    const spec = await service.runAnalysis('proj-1', agentRunner);

    expect(agentRunner).toHaveBeenCalledWith(
      expect.objectContaining({ cwd: '/repo', writableRoots: ['/repo/docs/pipeline/demo-modulo'] })
    );
    expect(prisma.spec.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          version: 1,
          functionalContent: '# spec funcional',
          technicalContent: '# spec técnica',
          complexityScore: 3,
          sensitivityFlags: ['rgpd']
        })
      })
    );
    expect(gates.openGatesForSpec).toHaveBeenCalledWith('spec-1', ['functional', 'technical']);
    expect(projects.transition).toHaveBeenNthCalledWith(1, 'proj-1', 'analyzing');
    expect(projects.transition).toHaveBeenNthCalledWith(2, 'proj-1', 'spec_ready');
    expect(projects.transition).toHaveBeenNthCalledWith(3, 'proj-1', 'pending_approval');
    expect(spec).toMatchObject({ id: 'spec-1' });
  });

  it('marca el run y el proyecto en error si el agente no tiene éxito', async () => {
    const { service, prisma, projects } = buildService();
    const agentRunner = vi.fn().mockResolvedValue({ ...successResult, success: false, errorMessage: 'boom' });

    await expect(service.runAnalysis('proj-1', agentRunner)).rejects.toThrow('boom');

    expect(prisma.run.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'error', errorMessage: 'boom' }) })
    );
    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'error');
  });

  it('marca error si el agente termina bien pero no deja los archivos de spec esperados', async () => {
    const { service, projects } = buildService();
    readFileMock.mockRejectedValue(new Error('ENOENT'));
    const agentRunner = vi.fn().mockResolvedValue(successResult);

    await expect(service.runAnalysis('proj-1', agentRunner)).rejects.toThrow(/no dejó los archivos/);
    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'error');
  });

  it('lanza si PLATFORM_REPO_PATH no está configurado', async () => {
    delete process.env.PLATFORM_REPO_PATH;
    const { service } = buildService();

    await expect(service.runAnalysis('proj-1', vi.fn())).rejects.toThrow(/PLATFORM_REPO_PATH/);
  });
});

const changeRequest = {
  id: 'cr-1',
  requestedBy: 'leonardo.barreto@awakelab.dev',
  requestText: 'Restringir "Desempeño por persona" a admin.',
  project: { id: 'proj-1', moduleSlug: 'gestor-proyectos', displayName: 'Gestor de proyectos' }
};

function buildChangeService() {
  const prisma = {
    changeRequest: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(changeRequest)
    },
    run: {
      create: vi.fn().mockResolvedValue({ id: 'run-1' }),
      update: vi.fn().mockResolvedValue(undefined)
    },
    spec: {
      // El módulo ya tiene v1: la mini-spec del cambio será v2 (count+1).
      count: vi.fn().mockResolvedValue(1),
      findFirst: vi.fn().mockResolvedValue({ technicalContent: '# técnica vigente del módulo' }),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'spec-2', ...data })
      )
    }
  } as unknown as PrismaService;

  const projects = {
    findById: vi.fn(),
    transition: vi.fn().mockResolvedValue(undefined)
  } as unknown as ProjectsService;

  const gates = { openGatesForSpec: vi.fn().mockResolvedValue(undefined) } as unknown as GatesService;

  return { service: new AnalysisRunnerService(prisma, projects, gates), prisma, projects, gates };
}

describe('AnalysisRunnerService.runChangeAnalysis (request_change)', () => {
  beforeEach(() => {
    process.env.PLATFORM_REPO_PATH = '/repo';
    readFileMock.mockReset();
  });

  it('corre el agente sobre el módulo vivo + la petición y crea una mini-spec enlazada al ChangeRequest', async () => {
    const { service, prisma, projects, gates } = buildChangeService();
    readFileMock
      .mockResolvedValueOnce('# cambio funcional')
      .mockResolvedValueOnce('# cambio técnico')
      .mockResolvedValueOnce(JSON.stringify({ complexityScore: 1, sensitivityFlags: [], reuseNotes: 'reusa RBAC' }));
    const agentRunner = vi.fn().mockResolvedValue(successResult);

    const spec = await service.runChangeAnalysis('cr-1', agentRunner);

    // El primer paso es transicionar el proyecto (desde su estado asentado) a analyzing.
    expect(projects.transition).toHaveBeenNthCalledWith(1, 'proj-1', 'analyzing');
    // La mini-spec se escribe en el directorio del cambio, numerado por su versión (v2).
    const agentCall = agentRunner.mock.calls[0]?.[0];
    expect(agentCall.writableRoots).toEqual(['/repo/docs/pipeline/gestor-proyectos/change-2']);
    expect(agentCall.prompt).toContain('Restringir "Desempeño por persona" a admin.');
    expect(agentCall.prompt).toContain('apps/api/src/modules/gestor-proyectos/');
    // La spec queda enlazada al ChangeRequest y con la versión siguiente.
    expect(prisma.spec.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ projectId: 'proj-1', version: 2, changeRequestId: 'cr-1' }) })
    );
    expect(gates.openGatesForSpec).toHaveBeenCalledWith('spec-2', ['functional', 'technical']);
    expect(projects.transition).toHaveBeenNthCalledWith(2, 'proj-1', 'spec_ready');
    expect(projects.transition).toHaveBeenNthCalledWith(3, 'proj-1', 'pending_approval');
    expect(spec).toMatchObject({ id: 'spec-2', changeRequestId: 'cr-1' });
  });

  it('marca error si el agente de cambio no deja los archivos de mini-spec', async () => {
    const { service, projects } = buildChangeService();
    readFileMock.mockRejectedValue(new Error('ENOENT'));
    const agentRunner = vi.fn().mockResolvedValue(successResult);

    await expect(service.runChangeAnalysis('cr-1', agentRunner)).rejects.toThrow(/no dejó los archivos/);
    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'error');
  });
});
