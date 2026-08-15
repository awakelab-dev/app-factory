import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { AnalysisJobsService } from './analysis-jobs.service';
import type { AnalysisRunnerService } from './analysis-runner.service';
import { AnalysisWorkerService } from './analysis-worker.service';
import type { ProjectsService } from './projects.service';
import type { AnalysisJobRow } from './types';

const job: AnalysisJobRow = {
  id: 'job-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  kind: 'analysis',
  projectId: 'proj-1',
  changeRequestId: null,
  status: 'running',
  attempts: 1,
  requestedBy: 'gerente@awakelab.dev',
  workerId: 'host:1',
  claimedAt: new Date(),
  heartbeatAt: new Date(),
  finishedAt: null,
  runId: null,
  errorMessage: null
};

function buildWorker(
  overrides: {
    claimed?: AnalysisJobRow | null;
    stale?: AnalysisJobRow[];
    projectStatus?: string;
    runAnalysis?: ReturnType<typeof vi.fn>;
    runChangeAnalysis?: ReturnType<typeof vi.fn>;
  } = {}
) {
  const prisma = {
    run: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    project: {
      findUnique: vi.fn().mockResolvedValue({ id: 'proj-1', status: overrides.projectStatus ?? 'analyzing' })
    }
  } as unknown as PrismaService;

  const jobs = {
    claimNext: vi.fn().mockResolvedValue(overrides.claimed === undefined ? job : overrides.claimed),
    reapStale: vi.fn().mockResolvedValue(overrides.stale ?? []),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    attachRun: vi.fn().mockResolvedValue(undefined),
    markSuccess: vi.fn().mockResolvedValue(undefined),
    markError: vi.fn().mockResolvedValue(undefined)
  } as unknown as AnalysisJobsService;

  const analysis = {
    runAnalysis: overrides.runAnalysis ?? vi.fn().mockResolvedValue({ id: 'spec-1', version: 1 }),
    runChangeAnalysis: overrides.runChangeAnalysis ?? vi.fn().mockResolvedValue({ id: 'spec-2', version: 2 })
  } as unknown as AnalysisRunnerService;

  const projects = { transition: vi.fn().mockResolvedValue(undefined) } as unknown as ProjectsService;

  return { worker: new AnalysisWorkerService(prisma, jobs, analysis, projects), prisma, jobs, analysis, projects };
}

describe('AnalysisWorkerService.runOnce', () => {
  beforeEach(() => {
    // El sync del checkout está apagado salvo en el contenedor del runner.
    delete process.env.FACTORY_WORKER_GIT_SYNC;
  });

  it('toma un trabajo de intake, corre el análisis y lo cierra en success', async () => {
    const { worker, jobs, analysis } = buildWorker();

    const processed = await worker.runOnce();

    expect(analysis.runAnalysis).toHaveBeenCalledWith('proj-1', undefined, expect.any(Object));
    expect(jobs.markSuccess).toHaveBeenCalledWith('job-1');
    expect(processed?.id).toBe('job-1');
  });

  it('un trabajo de cambio corre el análisis de cambio, no el de intake (los DOS caminos, D-046)', async () => {
    const { worker, analysis, jobs } = buildWorker({
      claimed: { ...job, kind: 'change_analysis', changeRequestId: 'cr-7' }
    });

    await worker.runOnce();

    expect(analysis.runChangeAnalysis).toHaveBeenCalledWith('cr-7', undefined, expect.any(Object));
    expect(analysis.runAnalysis).not.toHaveBeenCalled();
    expect(jobs.markSuccess).toHaveBeenCalled();
  });

  it('enlaza el Run con el trabajo en cuanto el runner lo crea (para poder cerrarlo si el proceso muere)', async () => {
    const runAnalysis = vi
      .fn()
      .mockImplementation(async (_id: string, _runner: unknown, hooks: { onRunStarted?: (id: string) => void }) => {
        await hooks.onRunStarted?.('run-42');
        return { id: 'spec-1', version: 1 };
      });
    const { worker, jobs } = buildWorker({ runAnalysis });

    await worker.runOnce();

    expect(jobs.attachRun).toHaveBeenCalledWith('job-1', 'run-42');
  });

  it('si el análisis falla, marca el trabajo en error con el motivo y NO tumba el worker', async () => {
    const { worker, jobs } = buildWorker({
      runAnalysis: vi.fn().mockRejectedValue(new Error('PLATFORM_REPO_PATH no está configurado'))
    });

    await expect(worker.runOnce()).resolves.toMatchObject({ id: 'job-1' });
    expect(jobs.markError).toHaveBeenCalledWith('job-1', expect.stringContaining('PLATFORM_REPO_PATH'));
  });

  it('un trabajo change_analysis sin changeRequestId se cierra en error, no revienta', async () => {
    const { worker, jobs, analysis } = buildWorker({ claimed: { ...job, kind: 'change_analysis' } });

    await worker.runOnce();

    expect(analysis.runChangeAnalysis).not.toHaveBeenCalled();
    expect(jobs.markError).toHaveBeenCalledWith('job-1', expect.stringContaining('changeRequestId'));
  });

  it('sin nada en la cola no hace nada y devuelve null', async () => {
    const { worker, analysis } = buildWorker({ claimed: null });

    expect(await worker.runOnce()).toBeNull();
    expect(analysis.runAnalysis).not.toHaveBeenCalled();
  });
});

describe('AnalysisWorkerService.reapStale (el saneo manual de D-046, automatizado)', () => {
  it('cierra el Run huérfano y saca al proyecto de analyzing', async () => {
    const { worker, prisma, projects } = buildWorker({
      claimed: null,
      stale: [{ ...job, id: 'job-muerto', runId: 'run-9', errorMessage: 'sin latido' }]
    });

    await worker.runOnce();

    expect(prisma.run.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-9', status: 'running' },
        data: expect.objectContaining({ status: 'error' })
      })
    );
    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'error');
  });

  it('no toca el proyecto si ya no está en analyzing (no pisa un estado legítimo)', async () => {
    const { worker, projects } = buildWorker({
      claimed: null,
      projectStatus: 'pending_approval',
      stale: [{ ...job, id: 'job-muerto', runId: null }]
    });

    await worker.runOnce();

    expect(projects.transition).not.toHaveBeenCalled();
  });
});
