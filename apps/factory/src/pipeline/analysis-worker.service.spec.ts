import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { AnalysisJobsService } from './analysis-jobs.service';
import type { AnalysisRunnerService } from './analysis-runner.service';
import { AnalysisWorkerService } from './analysis-worker.service';
import type { GenerationRunnerService } from './generation-runner.service';
import type { PrMergeService } from './pr-merge.service';
import type { ProjectsService } from './projects.service';
import type { AnalysisJobRow } from './types';

const job: AnalysisJobRow = {
  id: 'job-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  kind: 'analysis',
  projectId: 'proj-1',
  changeRequestId: null,
  specId: null,
  status: 'running',
  attempts: 1,
  nextAttemptAt: null,
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
    runGeneration?: ReturnType<typeof vi.fn>;
    runMerge?: ReturnType<typeof vi.fn>;
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
    markError: vi.fn().mockResolvedValue(undefined),
    requeueForRetry: vi.fn().mockResolvedValue(undefined)
  } as unknown as AnalysisJobsService;

  const analysis = {
    runAnalysis: overrides.runAnalysis ?? vi.fn().mockResolvedValue({ id: 'spec-1', version: 1 }),
    runChangeAnalysis: overrides.runChangeAnalysis ?? vi.fn().mockResolvedValue({ id: 'spec-2', version: 2 })
  } as unknown as AnalysisRunnerService;

  const projects = { transition: vi.fn().mockResolvedValue(undefined) } as unknown as ProjectsService;

  const generation = {
    runGeneration: overrides.runGeneration ?? vi.fn().mockResolvedValue({ id: 'run-1', prUrl: 'https://pr/1' })
  } as unknown as GenerationRunnerService;

  const prMerge = {
    runMerge: overrides.runMerge ?? vi.fn().mockResolvedValue({ prUrl: 'https://pr/1', alreadyMerged: false })
  } as unknown as PrMergeService;

  return {
    worker: new AnalysisWorkerService(prisma, jobs, analysis, projects, generation, prMerge),
    prisma,
    jobs,
    analysis,
    projects,
    generation,
    prMerge
  };
}

describe('AnalysisWorkerService.runOnce', () => {
  beforeEach(() => {
    // El sync del checkout está apagado salvo en el contenedor del runner.
    delete process.env.FACTORY_WORKER_GIT_SYNC;
    delete process.env.FACTORY_WORKER_KINDS;
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

  it('solo pide a la cola los kinds que sirve este proceso', async () => {
    process.env.FACTORY_WORKER_KINDS = 'generation,pr_merge';
    const { worker, jobs } = buildWorker({ claimed: null });

    await worker.runOnce();

    expect(jobs.claimNext).toHaveBeenCalledWith(expect.any(String), ['generation', 'pr_merge']);
  });
});

describe('AnalysisWorkerService — kinds de generación (D3)', () => {
  beforeEach(() => {
    delete process.env.FACTORY_WORKER_GIT_SYNC;
    process.env.FACTORY_WORKER_KINDS = 'generation,pr_merge';
  });

  it('un trabajo `generation` corre el runner de generación con el specId del trabajo', async () => {
    const { worker, generation, jobs } = buildWorker({ claimed: { ...job, kind: 'generation', specId: 'spec-9' } });

    await worker.runOnce();

    expect(generation.runGeneration).toHaveBeenCalledWith('spec-9', expect.any(Object));
    expect(jobs.markSuccess).toHaveBeenCalledWith('job-1');
  });

  it('`generation` sin specId se cierra en error sin gastar un agente', async () => {
    const { worker, generation, jobs } = buildWorker({ claimed: { ...job, kind: 'generation', specId: null } });

    await worker.runOnce();

    expect(generation.runGeneration).not.toHaveBeenCalled();
    expect(jobs.markError).toHaveBeenCalledWith('job-1', expect.stringContaining('specId'));
  });

  it('un trabajo `pr_merge` mergea la PR del proyecto y cierra el trabajo', async () => {
    const { worker, prMerge, jobs } = buildWorker({ claimed: { ...job, kind: 'pr_merge', specId: 'spec-9' } });

    await worker.runOnce();

    expect(prMerge.runMerge).toHaveBeenCalledWith('proj-1', 'spec-9');
    expect(jobs.markSuccess).toHaveBeenCalledWith('job-1');
  });

  it('NUNCA sincroniza el checkout en un kind de generación, aunque GIT_SYNC esté a 1 (borraría la rama)', async () => {
    // Es la garantía que impide el peor accidente posible: un `reset --hard
    // origin/main` sobre el checkout donde el agente tiene trabajo sin
    // commitear. Va en código, no en el .env del contenedor.
    process.env.FACTORY_WORKER_GIT_SYNC = '1';
    const { worker, generation } = buildWorker({ claimed: { ...job, kind: 'generation', specId: 'spec-9' } });

    // Si intentara sincronizar, `assertRunnerEnv` fallaría aquí (sin
    // PLATFORM_REPO_PATH) y el trabajo se cerraría en error sin generar nada.
    await worker.runOnce();

    expect(generation.runGeneration).toHaveBeenCalled();
  });
});

describe('AnalysisWorkerService — reintento clasificado (D3)', () => {
  beforeEach(() => {
    delete process.env.FACTORY_WORKER_GIT_SYNC;
    process.env.FACTORY_WORKER_KINDS = 'generation,pr_merge';
  });

  it('un corte de red reencola con backoff en vez de dar el trabajo por perdido (el caso de D-048)', async () => {
    const { worker, jobs } = buildWorker({
      claimed: { ...job, kind: 'generation', specId: 'spec-9', attempts: 1 },
      runGeneration: vi.fn().mockRejectedValue(new Error('Connection closed mid-response'))
    });

    await worker.runOnce();

    expect(jobs.requeueForRetry).toHaveBeenCalledWith('job-1', 2, expect.stringContaining('Connection closed'));
    expect(jobs.markError).not.toHaveBeenCalled();
  });

  it('el segundo intento espera más (2 → 10 min)', async () => {
    const { worker, jobs } = buildWorker({
      claimed: { ...job, kind: 'generation', specId: 'spec-9', attempts: 2 },
      runGeneration: vi.fn().mockRejectedValue(new Error('fetch failed'))
    });

    await worker.runOnce();

    expect(jobs.requeueForRetry).toHaveBeenCalledWith('job-1', 10, expect.any(String));
  });

  it('agotados los intentos deja el trabajo en error, no reintenta para siempre', async () => {
    const { worker, jobs } = buildWorker({
      claimed: { ...job, kind: 'generation', specId: 'spec-9', attempts: 3 },
      runGeneration: vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    });

    await worker.runOnce();

    expect(jobs.requeueForRetry).not.toHaveBeenCalled();
    expect(jobs.markError).toHaveBeenCalledWith('job-1', expect.stringContaining('ECONNRESET'));
  });

  it('un fallo del AGENTE no se reintenta: reintentarlo solo gastaría otro run para volver al mismo sitio', async () => {
    const { worker, jobs } = buildWorker({
      claimed: { ...job, kind: 'generation', specId: 'spec-9', attempts: 1 },
      runGeneration: vi.fn().mockRejectedValue(new Error('El run de generación no tuvo éxito: build failed'))
    });

    await worker.runOnce();

    expect(jobs.requeueForRetry).not.toHaveBeenCalled();
    expect(jobs.markError).toHaveBeenCalled();
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

  it('también destapa un proyecto atascado en "generating" (D3: el generador puede morir igual)', async () => {
    const { worker, projects } = buildWorker({
      claimed: null,
      projectStatus: 'generating',
      stale: [{ ...job, id: 'job-muerto', kind: 'generation', specId: 'spec-9', runId: null }]
    });

    await worker.runOnce();

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
