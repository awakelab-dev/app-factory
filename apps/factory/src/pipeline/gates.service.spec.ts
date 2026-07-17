import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { GatesService } from './gates.service';
import type { ProjectsService } from './projects.service';

function buildService(overrides: { gateStatus?: string; gateType?: string; projectStatus?: string } = {}) {
  const gate = {
    id: 'gate-1',
    status: overrides.gateStatus ?? 'pending',
    gateType: overrides.gateType ?? 'functional',
    spec: { project: { id: 'proj-1', status: overrides.projectStatus ?? 'pending_approval' } }
  };

  const prisma = {
    gate: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(gate),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...gate, ...data }))
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

  it('approved en el gate de manager_acceptance transiciona a "deployed"', async () => {
    const { service, projects } = buildService({ gateType: 'manager_acceptance' });

    await service.decide({ gateId: 'gate-1', decision: 'approved', reviewer: 'x@y.com' });

    expect(projects.transition).toHaveBeenCalledWith('proj-1', 'deployed');
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
