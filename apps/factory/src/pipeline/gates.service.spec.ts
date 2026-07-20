import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { GatesService } from './gates.service';
import type { ProjectsService } from './projects.service';

function buildService(overrides: { gateStatus?: string; gateType?: string; projectStatus?: string } = {}) {
  const gate = {
    id: 'gate-1',
    specId: 'spec-1',
    status: overrides.gateStatus ?? 'pending',
    gateType: overrides.gateType ?? 'functional',
    spec: { project: { id: 'proj-1', status: overrides.projectStatus ?? 'pending_approval' } }
  };

  const prisma = {
    gate: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(gate),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...gate, ...data })),
      create: vi.fn().mockResolvedValue({ id: 'gate-nuevo' })
    },
    $transaction: vi.fn().mockImplementation((ops: unknown[]) => Promise.all(ops))
  } as unknown as PrismaService;

  const projects = { transition: vi.fn().mockResolvedValue(undefined) } as unknown as ProjectsService;

  return { service: new GatesService(prisma, projects), prisma, projects, gate };
}

describe('GatesService.decide', () => {
  it('approved en un gate funcional NO dispara ninguna transición (un dev lanza generate por separado)', async () => {
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

  it('approved en el gate de pr_review transiciona a "staging"', async () => {
    const { service, projects } = buildService({ gateType: 'pr_review' });

    await service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: 'x@y.com' });

    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'staging');
  });

  it('approved en manager_acceptance transiciona a "manager_acceptance" desde staging (NO a "deployed": esa transición no existe desde staging — deployed es solo la promoción a producción vía advance)', async () => {
    const { service, projects } = buildService({ gateType: 'manager_acceptance', projectStatus: 'staging' });

    await service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: 'x@y.com' });

    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'manager_acceptance');
    expect(projects.transition).not.toHaveBeenCalledWith('proj-1', 'deployed');
  });

  it('approved en pr_review abre el gate manager_acceptance sobre la misma spec (primera clase)', async () => {
    const { service, prisma } = buildService({ gateType: 'pr_review', projectStatus: 'pr_review' });

    await service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: 'x@y.com' });

    expect(prisma.gate.create).toHaveBeenCalledWith({ data: { specId: 'spec-1', gateType: 'manager_acceptance' } });
  });

  it('changes_requested en pr_review manda a "changes_requested" (regenerar), NO a spec_ready', async () => {
    const { service, projects } = buildService({ gateType: 'pr_review', projectStatus: 'pr_review' });

    await service.decide({ gateId: 'gate-1', decision: 'changes_requested', reviewer: 'x@y.com', notes: 'falta X' });

    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'changes_requested');
    expect(projects.transition).not.toHaveBeenCalledWith('proj-1', 'spec_ready');
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

describe('GatesService.amendNotes', () => {
  it('enmienda un gate ya decidido preservando la nota original + sello de auditoría, sin cambiar el status', async () => {
    const decided = { id: 'gate-1', status: 'approved', decisionNotes: 'Nota original.' };
    const prisma = {
      gate: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(decided),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...decided, ...data }))
      }
    } as unknown as PrismaService;
    const service = new GatesService(prisma, {} as ProjectsService);

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
    const service = new GatesService(prisma, {} as ProjectsService);

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
    const service = new GatesService(prisma, {} as ProjectsService);

    await expect(service.areSpecGatesApproved('spec-1', ['functional', 'technical'])).resolves.toBe(false);
    await expect(service.areSpecGatesApproved('spec-1', ['functional'])).resolves.toBe(true);
  });
});
