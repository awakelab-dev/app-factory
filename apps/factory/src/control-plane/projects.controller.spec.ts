import { describe, expect, it, vi } from 'vitest';
import type { ProjectsService } from '../pipeline/projects.service';
import type { FactoryActorContext } from '../pipeline/types';
import { ProjectsController } from './projects.controller';

const NOW = new Date('2026-07-15T10:00:00.000Z');
const ADMIN: FactoryActorContext = { email: 'leonardo.barreto@awakelab.dev', role: 'admin' };

function buildProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1',
    createdAt: NOW,
    updatedAt: NOW,
    moduleSlug: 'orientador-ia',
    displayName: 'Orientador IA',
    requestedBy: 'leonardo.barreto@awakelab.dev',
    sourceType: 'manual',
    sourceRef: '/ruta/al/prototipo',
    status: 'pending_approval',
    ...overrides
  };
}

function buildSpec(overrides: Record<string, unknown> = {}) {
  return {
    id: 'spec-1',
    createdAt: NOW,
    version: 1,
    functionalContent: '# Spec funcional',
    technicalContent: '# Spec técnica',
    complexityScore: 3,
    sensitivityFlags: ['datos_personales'],
    reuseNotes: 'usa el core de auth',
    gates: [
      {
        id: 'gate-1',
        createdAt: NOW,
        gateType: 'functional',
        status: 'pending',
        reviewer: null,
        decisionNotes: null,
        decidedAt: null
      },
      {
        id: 'gate-2',
        createdAt: NOW,
        gateType: 'technical',
        status: 'approved',
        reviewer: 'x@y.com',
        decisionNotes: 'ok',
        decidedAt: NOW
      }
    ],
    ...overrides
  };
}

describe('ProjectsController.list', () => {
  it('mapea el resumen: fechas ISO, última versión de spec y gates pendientes', async () => {
    const projects = {
      list: vi.fn().mockResolvedValue([buildProject({ specs: [buildSpec({ version: 2 }), buildSpec({ id: 'spec-0' })] })])
    } as unknown as ProjectsService;
    const controller = new ProjectsController(projects);

    const result = await controller.list(ADMIN);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'proj-1',
      moduleSlug: 'orientador-ia',
      status: 'pending_approval',
      createdAt: NOW.toISOString(),
      latestSpecVersion: 2,
      pendingGates: 2 // un gate pending por cada una de las dos specs
    });
  });

  it('proyecto recién creado (sin specs): latestSpecVersion null y 0 pendientes', async () => {
    const projects = {
      list: vi.fn().mockResolvedValue([buildProject({ status: 'received', specs: [] })])
    } as unknown as ProjectsService;
    const controller = new ProjectsController(projects);

    const rows = await controller.list(ADMIN);

    expect(rows[0]?.latestSpecVersion).toBeNull();
    expect(rows[0]?.pendingGates).toBe(0);
  });
});

describe('ProjectsController.detail', () => {
  it('mapea el detalle completo: specs con gates, runs y sensitivityFlags saneados', async () => {
    const run = {
      id: 'run-1',
      createdAt: NOW,
      startedAt: NOW,
      finishedAt: null,
      runType: 'analysis',
      status: 'success',
      branchName: null,
      prUrl: null,
      agentSessionId: 'sess-1',
      outputSummary: 'spec generada',
      errorMessage: null,
      costUsd: 0.42,
      inputTokens: 1000,
      outputTokens: 2000
    };
    // sensitivityFlags es una columna Json: si trae algo que no es string[], se sanea.
    const spec = buildSpec({ sensitivityFlags: ['rgpd', 42, null] });
    const projects = {
      getFullStatus: vi.fn().mockResolvedValue(buildProject({ specs: [spec], runs: [run] }))
    } as unknown as ProjectsService;
    const controller = new ProjectsController(projects);

    const detail = await controller.detail('proj-1', ADMIN);

    expect(projects.getFullStatus).toHaveBeenCalledWith('proj-1', ADMIN);
    expect(detail.sourceRef).toBe('/ruta/al/prototipo');
    expect(detail.specs[0]?.sensitivityFlags).toEqual(['rgpd']);
    expect(detail.specs[0]?.gates[1]).toMatchObject({
      status: 'approved',
      reviewer: 'x@y.com',
      decidedAt: NOW.toISOString()
    });
    expect(detail.runs[0]).toMatchObject({
      runType: 'analysis',
      status: 'success',
      startedAt: NOW.toISOString(),
      finishedAt: null,
      costUsd: 0.42
    });
    // Sin trabajos de cola (un proyecto creado por CLI): array vacío, no undefined.
    expect(detail.analysisJobs).toEqual([]);
  });

  it('expone los trabajos de la cola con intentos y motivo del fallo (incremento D, bloque 5)', async () => {
    // El caso que hasta ahora solo se veía con `docker compose logs` por SSH:
    // el trabajo murió y el proyecto "no avanzaba" sin explicación en ningún sitio.
    const job = {
      id: 'job-1',
      createdAt: NOW,
      kind: 'analysis',
      status: 'error',
      attempts: 2,
      requestedBy: 'gerente@awakelab.world',
      workerId: 'runner-1:42',
      claimedAt: NOW,
      heartbeatAt: NOW,
      finishedAt: NOW,
      runId: 'run-1',
      errorMessage: 'API Error: Connection closed mid-response',
      changeRequestId: null
    };
    const projects = {
      getFullStatus: vi
        .fn()
        .mockResolvedValue(buildProject({ status: 'error', specs: [], runs: [], analysisJobs: [job] }))
    } as unknown as ProjectsService;

    const detail = await new ProjectsController(projects).detail('proj-1', ADMIN);

    expect(detail.analysisJobs).toEqual([
      {
        id: 'job-1',
        createdAt: NOW.toISOString(),
        kind: 'analysis',
        status: 'error',
        attempts: 2,
        requestedBy: 'gerente@awakelab.world',
        workerId: 'runner-1:42',
        claimedAt: NOW.toISOString(),
        heartbeatAt: NOW.toISOString(),
        finishedAt: NOW.toISOString(),
        runId: 'run-1',
        errorMessage: 'API Error: Connection closed mid-response',
        changeRequestId: null
      }
    ]);
  });
});
