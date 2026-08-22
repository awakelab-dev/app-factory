import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import type { AnalysisJobsService } from './analysis-jobs.service';
import { GatesService } from './gates.service';
import type { ProjectsService } from './projects.service';

/** Doble de la cola: `decide` encola desde D3, no ejecuta nada. */
function jobsDouble(alreadyQueued = false) {
  return {
    enqueue: vi.fn().mockResolvedValue({ job: { id: 'job-1', kind: 'generation' }, alreadyQueued })
  } as unknown as AnalysisJobsService;
}

function buildService(
  overrides: {
    gateStatus?: string;
    gateType?: string;
    projectStatus?: string;
    requestedBy?: string;
    /** Gates de la spec que ve `areSpecGatesApproved` tras esta decisión. */
    specGates?: { gateType: string; status: string }[];
    pendingManagerGate?: boolean;
  } = {}
) {
  const gate = {
    id: 'gate-1',
    specId: 'spec-1',
    status: overrides.gateStatus ?? 'pending',
    gateType: overrides.gateType ?? 'functional',
    spec: {
      project: {
        id: 'proj-1',
        status: overrides.projectStatus ?? 'pending_approval',
        requestedBy: overrides.requestedBy ?? 'leonardo.barreto@awakelab.dev'
      }
    }
  };

  const prisma = {
    gate: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(gate),
      findFirst: vi.fn().mockResolvedValue(overrides.pendingManagerGate ? { id: 'gate-ma' } : null),
      findMany: vi.fn().mockResolvedValue(
        overrides.specGates ?? [
          { gateType: 'functional', status: 'approved' },
          { gateType: 'technical', status: 'pending' }
        ]
      ),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...gate, ...data })),
      create: vi.fn().mockResolvedValue({ id: 'gate-nuevo' })
    },
    $transaction: vi.fn().mockImplementation((ops: unknown[]) => Promise.all(ops))
  } as unknown as PrismaService;

  const projects = { transition: vi.fn().mockResolvedValue(undefined) } as unknown as ProjectsService;
  const jobs = jobsDouble();

  return { service: new GatesService(prisma, projects, jobs), prisma, projects, jobs, gate };
}

describe('GatesService.decide', () => {
  it('approved en un gate funcional NO transiciona el proyecto (lo hace el runner al empezar a generar)', async () => {
    const { service, projects } = buildService({ gateType: 'functional' });

    await service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: 'x@y.com' });

    expect(projects.transition).not.toHaveBeenCalled();
  });

  it('rejected transiciona el proyecto a "rejected"', async () => {
    const { service, projects } = buildService({ gateType: 'functional' });

    await service.decide({ gateId: 'gate-1', decision: 'rejected', reviewer: 'x@y.com', notes: 'no aplica' });

    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'rejected');
  });

  it('changes_requested ("complementar") vuelve el proyecto a "spec_ready"', async () => {
    const { service, projects } = buildService({ gateType: 'technical' });

    await service.decide({ gateId: 'gate-1', decision: 'changes_requested', reviewer: 'x@y.com' });

    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'spec_ready');
  });

  it('approved en pr_review NO transiciona a staging: encola el merge y el estado lo mueve quien lo comprueba (D3)', async () => {
    const { service, projects, jobs } = buildService({ gateType: 'pr_review', projectStatus: 'pr_review' });

    await service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: 'x@y.com' });

    // El gate era declarativo (D-049): decía "staging" con la PR aún abierta.
    expect(projects.transition).not.toHaveBeenCalled();
    expect(jobs.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'pr_merge', specId: 'spec-1', projectId: 'proj-1', requestedBy: 'x@y.com' })
    );
  });

  it('approved en manager_acceptance transiciona a "manager_acceptance" desde staging (NO a "deployed": esa transición no existe desde staging — deployed es solo la promoción a producción vía advance)', async () => {
    const { service, projects } = buildService({ gateType: 'manager_acceptance', projectStatus: 'staging' });

    await service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: 'x@y.com' });

    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'manager_acceptance');
    expect(projects.transition).not.toHaveBeenCalledWith('proj-1', 'deployed');
  });

  it('approved en pr_review ya NO abre manager_acceptance: lo abre el merge, cuando hay algo en staging que validar', async () => {
    const { service, prisma } = buildService({ gateType: 'pr_review', projectStatus: 'pr_review' });

    await service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: 'x@y.com' });

    expect(prisma.gate.create).not.toHaveBeenCalled();
  });

  it('changes_requested en pr_review manda a "changes_requested" (regenerar), NO a spec_ready, y encola la regeneración', async () => {
    const { service, projects, jobs } = buildService({ gateType: 'pr_review', projectStatus: 'pr_review' });

    await service.decide({ gateId: 'gate-1', decision: 'changes_requested', reviewer: 'x@y.com', notes: 'falta X' });

    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'changes_requested');
    expect(projects.transition).not.toHaveBeenCalledWith('proj-1', 'spec_ready');
    expect(jobs.enqueue).toHaveBeenCalledWith(expect.objectContaining({ kind: 'generation', specId: 'spec-1' }));
  });

  it('changes_requested en manager_acceptance manda a "changes_requested" (regenerar)', async () => {
    const { service, projects } = buildService({ gateType: 'manager_acceptance', projectStatus: 'manager_acceptance' });

    await service.decide({ gateId: 'gate-1', decision: 'changes_requested', reviewer: 'x@y.com', notes: 'ajustar' });

    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'changes_requested');
  });

  it('rejected con el proyecto YA en "rejected" (el otro gate lo rechazó antes) registra la decisión sin re-transicionar', async () => {
    const { service, prisma, projects } = buildService({ gateType: 'technical', projectStatus: 'rejected' });

    const gate = await service.decide({ gateId: 'gate-1', decision: 'rejected', reviewer: 'x@y.com', notes: 'duplicado' });

    expect(projects.transition).not.toHaveBeenCalled();
    expect(prisma.gate.update).toHaveBeenCalled();
    expect(gate.status).toBe('rejected');
  });

  it('si la transición del proyecto falla, el gate NO queda decidido (transición antes que escritura)', async () => {
    const { service, prisma, projects } = buildService({ gateType: 'technical' });
    (projects.transition as ReturnType<typeof vi.fn>).mockRejectedValue(new BadRequestException('inválida'));

    await expect(
      service.decide({ gateId: 'gate-1', decision: 'rejected', reviewer: 'x@y.com', notes: 'x' })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.gate.update).not.toHaveBeenCalled();
  });

  it('rechaza decidir un gate que ya no está pending', async () => {
    const { service, prisma } = buildService({ gateStatus: 'approved' });

    await expect(service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: 'x@y.com' })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.gate.update).not.toHaveBeenCalled();
  });
});

describe('GatesService.decide — disparo de trabajo (D3: se acabó el `cli generate`)', () => {
  const bothApproved = [
    { gateType: 'functional', status: 'approved' },
    { gateType: 'technical', status: 'approved' }
  ];

  it('el gate que completa functional+technical encola la generación con su specId', async () => {
    const { service, jobs } = buildService({ gateType: 'technical', specGates: bothApproved });

    await service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: 'leo@awakelab.dev' });

    // Esto es lo que mata D-048 ("aprobé los dos gates y no pasa nada").
    expect(jobs.enqueue).toHaveBeenCalledWith({
      kind: 'generation',
      projectId: 'proj-1',
      specId: 'spec-1',
      requestedBy: 'leo@awakelab.dev'
    });
  });

  it('con el otro gate todavía pendiente NO encola nada (nunca se genera sin los dos gates)', async () => {
    const { service, jobs } = buildService({
      gateType: 'functional',
      specGates: [
        { gateType: 'functional', status: 'approved' },
        { gateType: 'technical', status: 'pending' }
      ]
    });

    await service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: 'x@y.com' });

    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('rechazar un gate de spec no encola nada aunque el otro esté aprobado', async () => {
    const { service, jobs } = buildService({ gateType: 'technical', specGates: bothApproved });

    await service.decide({ gateId: 'gate-1', decision: 'rejected', reviewer: 'x@y.com', notes: 'duplicado' });

    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it('el trabajo se encola DESPUÉS de escribir el gate (si encolar falla, la decisión ya está registrada)', async () => {
    const { service, prisma, jobs } = buildService({ gateType: 'technical', specGates: bothApproved });
    const order: string[] = [];
    (prisma.gate.update as ReturnType<typeof vi.fn>).mockImplementation(({ data }) => {
      order.push('gate');
      return Promise.resolve({ id: 'gate-1', ...data });
    });
    (jobs.enqueue as ReturnType<typeof vi.fn>).mockImplementation(() => {
      order.push('enqueue');
      return Promise.resolve({ job: { id: 'job-1', kind: 'generation' }, alreadyQueued: false });
    });

    await service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: 'x@y.com' });

    expect(order).toEqual(['gate', 'enqueue']);
  });
});

describe('GatesService.decide — modelo de roles (D-036)', () => {
  const gerente = { email: 'gerente@awakelab.dev', role: 'gerente' as const };

  it('un gerente decide el gate functional de SU proyecto', async () => {
    const { service, prisma } = buildService({ gateType: 'functional', requestedBy: gerente.email });

    await service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: gerente.email, actor: gerente });

    expect(prisma.gate.update).toHaveBeenCalled();
  });

  it('un gerente decide manager_acceptance de SU proyecto', async () => {
    const { service, prisma } = buildService({
      gateType: 'manager_acceptance',
      projectStatus: 'staging',
      requestedBy: gerente.email
    });

    await service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: gerente.email, actor: gerente });

    expect(prisma.gate.update).toHaveBeenCalled();
  });

  it('403 si un gerente intenta decidir un gate technical (solo-admin), aun de SU proyecto', async () => {
    const { service, prisma } = buildService({ gateType: 'technical', requestedBy: gerente.email });

    await expect(
      service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: gerente.email, actor: gerente })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.gate.update).not.toHaveBeenCalled();
  });

  it('403 si un gerente intenta decidir pr_review (solo-admin)', async () => {
    const { service, prisma } = buildService({ gateType: 'pr_review', requestedBy: gerente.email });

    await expect(
      service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: gerente.email, actor: gerente })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.gate.update).not.toHaveBeenCalled();
  });

  it('403 si un gerente intenta decidir un gate functional de un proyecto AJENO', async () => {
    const { service, prisma, projects } = buildService({ gateType: 'functional', requestedBy: 'otro@awakelab.dev' });

    await expect(
      service.decide({ gateId: 'gate-1', decision: 'rejected', reviewer: gerente.email, actor: gerente })
    ).rejects.toBeInstanceOf(ForbiddenException);
    // El scope va ANTES de cualquier escritura/transición.
    expect(projects.transition).not.toHaveBeenCalled();
    expect(prisma.gate.update).not.toHaveBeenCalled();
  });

  it('un actor admin decide cualquier gate de cualquier proyecto', async () => {
    const { service, prisma } = buildService({ gateType: 'pr_review', projectStatus: 'pr_review', requestedBy: 'otro@x.dev' });

    await service.decide({
      gateId: 'gate-1',
      decision: 'approved',
      reviewer: 'leonardo.barreto@awakelab.dev',
      actor: { email: 'leonardo.barreto@awakelab.dev', role: 'admin' }
    });

    expect(prisma.gate.update).toHaveBeenCalled();
  });
});

describe('GatesService.amendNotes', () => {
  it('enmienda un gate ya decidido preservando la nota original + sello de auditoría, sin cambiar el status', async () => {
    const decided = { id: 'gate-1', status: 'approved', decisionNotes: 'Nota original.' };
    const prisma = {
      gate: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(decided),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...decided, ...data }))
      }
    } as unknown as PrismaService;
    const service = new GatesService(prisma, {} as ProjectsService, jobsDouble());

    const updated = await service.amendNotes({ gateId: 'gate-1', reviewer: 'leo@awakelab.dev', notes: 'Precisión añadida.' });

    const writtenNotes: string = (prisma.gate.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.data?.decisionNotes;
    expect(writtenNotes).toContain('Nota original.');
    expect(writtenNotes).toContain('[enmienda');
    expect(writtenNotes).toContain('por leo@awakelab.dev');
    expect(writtenNotes).toContain('Precisión añadida.');
    // No toca el status.
    expect((prisma.gate.update as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.data?.status).toBeUndefined();
    expect(updated.status).toBe('approved');
  });

  it('rechaza enmendar un gate que sigue pending (debe decidirse, no enmendarse)', async () => {
    const prisma = {
      gate: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'gate-1', status: 'pending', decisionNotes: null }),
        update: vi.fn()
      }
    } as unknown as PrismaService;
    const service = new GatesService(prisma, {} as ProjectsService, jobsDouble());

    await expect(
      service.amendNotes({ gateId: 'gate-1', reviewer: 'x@y.com', notes: 'x' })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.gate.update).not.toHaveBeenCalled();
  });
});

describe('GatesService.areSpecGatesApproved', () => {
  it('es true solo si TODOS los tipos pedidos están approved', async () => {
    const prisma = {
      gate: {
        findMany: vi.fn().mockResolvedValue([
          { gateType: 'functional', status: 'approved' },
          { gateType: 'technical', status: 'pending' }
        ])
      }
    } as unknown as PrismaService;
    const service = new GatesService(prisma, {} as ProjectsService, jobsDouble());

    await expect(service.areSpecGatesApproved('spec-1', ['functional', 'technical'])).resolves.toBe(false);
    await expect(service.areSpecGatesApproved('spec-1', ['functional'])).resolves.toBe(true);
  });
});
