import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { AnalysisJobsService, type AnalysisJobsTx } from './analysis-jobs.service';

function buildService(overrides: { activeJob?: Record<string, unknown> | null } = {}) {
  const analysisJob = {
    findFirst: vi.fn().mockResolvedValue(overrides.activeJob ?? null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'job-1', ...data })),
    update: vi.fn().mockResolvedValue(undefined),
    updateMany: vi.fn().mockResolvedValue({ count: 1 })
  };
  const queryRaw = vi.fn().mockResolvedValue([]);
  const executeRaw = vi.fn().mockResolvedValue(1);
  const prisma = {
    analysisJob,
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    $transaction: vi
      .fn()
      .mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn({ analysisJob, $queryRaw: queryRaw }))
  } as unknown as PrismaService;

  return { service: new AnalysisJobsService(prisma), prisma, analysisJob, queryRaw, executeRaw };
}

describe('AnalysisJobsService.enqueue', () => {
  it('encola un análisis de intake tomando antes el lock de fila del proyecto', async () => {
    const { service, analysisJob, queryRaw } = buildService();

    const { job, alreadyQueued } = await service.enqueue({
      kind: 'analysis',
      projectId: 'proj-1',
      requestedBy: 'gerente@awakelab.dev'
    });

    // El lock serializa dos encolados simultáneos del MISMO proyecto sin
    // bloquear el resto de la tabla.
    const lockSql = queryRaw.mock.calls[0]?.[0]?.join?.('') ?? '';
    expect(lockSql).toContain('FOR UPDATE');
    expect(analysisJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'analysis', projectId: 'proj-1', requestedBy: 'gerente@awakelab.dev' })
      })
    );
    expect(job.id).toBe('job-1');
    expect(alreadyQueued).toBe(false);
  });

  it('con un trabajo ya activo para el proyecto devuelve ESE y no encola un segundo (nunca dos runs)', async () => {
    const { service, analysisJob } = buildService({ activeJob: { id: 'job-previo', status: 'running' } });

    const { job, alreadyQueued } = await service.enqueue({
      kind: 'analysis',
      projectId: 'proj-1',
      requestedBy: 'gerente@awakelab.dev'
    });

    expect(analysisJob.create).not.toHaveBeenCalled();
    expect(job.id).toBe('job-previo');
    expect(alreadyQueued).toBe(true);
  });

  it('solo considera activos los estados queued y running', async () => {
    const { service, analysisJob } = buildService();

    await service.enqueue({ kind: 'analysis', projectId: 'proj-1', requestedBy: 'x@y.com' });

    expect(analysisJob.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: 'proj-1', status: { in: ['queued', 'running'] } } })
    );
  });

  it('encolando dentro de una transacción ajena usa ESA (submit_prototype: todo o nada)', async () => {
    const { service, prisma } = buildService();
    const txAnalysisJob = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'job-tx' })
    };
    const tx = { analysisJob: txAnalysisJob, $queryRaw: vi.fn().mockResolvedValue([]) } as unknown as AnalysisJobsTx;

    const { job } = await service.enqueueIn(tx, { kind: 'analysis', projectId: 'proj-1', requestedBy: 'x@y.com' });

    expect(job.id).toBe('job-tx');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('AnalysisJobsService.claimNext', () => {
  it('toma el trabajo con SKIP LOCKED (dos workers no pueden tomar el mismo)', async () => {
    const { service, queryRaw } = buildService();
    queryRaw.mockResolvedValueOnce([{ id: 'job-1', kind: 'analysis', projectId: 'proj-1' }]);

    const job = await service.claimNext('host:123');

    const sql = queryRaw.mock.calls[0]?.[0]?.join?.('') ?? '';
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain('attempts = attempts + 1');
    expect(job?.id).toBe('job-1');
  });

  it('devuelve null si la cola está vacía', async () => {
    const { service, queryRaw } = buildService();
    queryRaw.mockResolvedValueOnce([]);

    expect(await service.claimNext('host:123')).toBeNull();
  });
});

describe('AnalysisJobsService.reapStale', () => {
  it('marca en error los trabajos running sin latido y los devuelve para sanear', async () => {
    const { service, queryRaw } = buildService();
    queryRaw.mockResolvedValueOnce([{ id: 'job-muerto', projectId: 'proj-1', runId: 'run-9' }]);

    const stale = await service.reapStale(1000);

    const sql = queryRaw.mock.calls[0]?.[0]?.join?.('') ?? '';
    expect(sql).toContain('heartbeatAt');
    expect(sql).toContain('make_interval');
    expect(stale).toHaveLength(1);
    expect(stale[0]?.id).toBe('job-muerto');
  });
});

describe('AnalysisJobsService — cierre de trabajos', () => {
  it('markSuccess limpia el mensaje de error de un intento anterior', async () => {
    const { service, analysisJob } = buildService();

    await service.markSuccess('job-1');

    expect(analysisJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'success', errorMessage: null }) })
    );
  });

  it('el latido solo toca trabajos running y usa el reloj de la BASE, no el del proceso', async () => {
    const { service, executeRaw } = buildService();

    await service.heartbeat('job-1');

    const sql = executeRaw.mock.calls[0]?.[0]?.join?.('') ?? '';
    // El barrido compara contra now() de la base: los dos lados del check
    // tienen que salir del mismo reloj (worker y managed PG son máquinas
    // distintas).
    expect(sql).toContain('now()');
    expect(sql).toContain("status = 'running'");
  });
});
