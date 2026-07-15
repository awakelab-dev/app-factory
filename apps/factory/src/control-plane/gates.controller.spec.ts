import { describe, expect, it, vi } from 'vitest';
import type { GatesService } from '../pipeline/gates.service';
import { GatesController } from './gates.controller';

const NOW = new Date('2026-07-15T10:00:00.000Z');

describe('GatesController.decide', () => {
  it('pasa la decisión a GatesService con el reviewer del JWT (nunca del body) y devuelve el gate mapeado', async () => {
    const gates = {
      decide: vi.fn().mockResolvedValue({
        id: 'gate-1',
        createdAt: NOW,
        gateType: 'functional',
        status: 'approved',
        reviewer: 'leonardo.barreto@awakelab.dev',
        decisionNotes: 'listo',
        decidedAt: NOW
      })
    } as unknown as GatesService;
    const controller = new GatesController(gates);

    const result = await controller.decide(
      'gate-1',
      { decision: 'approved', notes: 'listo' },
      { id: 'u1', email: 'leonardo.barreto@awakelab.dev', displayName: 'Leonardo', roles: ['admin'] }
    );

    expect(gates.decide).toHaveBeenCalledWith({
      gateId: 'gate-1',
      decision: 'approved',
      reviewer: 'leonardo.barreto@awakelab.dev',
      notes: 'listo'
    });
    expect(result).toEqual({
      id: 'gate-1',
      createdAt: NOW.toISOString(),
      gateType: 'functional',
      status: 'approved',
      reviewer: 'leonardo.barreto@awakelab.dev',
      decisionNotes: 'listo',
      decidedAt: NOW.toISOString()
    });
  });
});
