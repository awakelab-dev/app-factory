import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../../core/audit/audit.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { ORIENTADOR_MAX_ANALYSES_PER_EMAIL, OrientadorIntakeService } from './orientador-intake.service';
import type { OrientadorClaudeService } from './orientador-claude.service';

const baseDto = {
  fullName: 'Ana Pérez',
  email: 'ana@test.dev',
  consentGiven: true as const,
  consentMarketing: false,
  rawInputType: 'story' as const,
  rawInputText: 'Llevo 2 años en marketing digital...'
};

function buildService(overrides: {
  priorCount?: number;
  claudeConfigured?: boolean;
  analyzeImpl?: () => Promise<unknown>;
}) {
  const createdLead = { id: 'lead-1' };
  const createdProfile = {
    leadId: 'lead-1',
    recommendedSector: 'marketing',
    rationale: 'texto',
    estimatedLevel: 'inicial',
    skillGaps: ['SEO'],
    createdAt: new Date('2026-07-14T00:00:00.000Z')
  };

  const prisma = {
    orientadorLead: {
      count: vi.fn().mockResolvedValue(overrides.priorCount ?? 0),
      create: vi.fn().mockResolvedValue(createdLead)
    },
    orientadorProfile: {
      create: vi.fn().mockResolvedValue(createdProfile)
    }
  } as unknown as PrismaService;

  const claude = {
    isConfigured: overrides.claudeConfigured ?? true,
    analyze:
      overrides.analyzeImpl ??
      vi.fn().mockResolvedValue({
        recommendedSector: 'marketing',
        rationale: 'texto',
        estimatedLevel: 'inicial',
        skillGaps: ['SEO'],
        model: 'claude-haiku-4-5-20251001'
      })
  } as unknown as OrientadorClaudeService;

  const audit = { log: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;

  return { service: new OrientadorIntakeService(prisma, claude, audit), prisma, claude, audit };
}

describe('OrientadorIntakeService.submit', () => {
  it('crea el lead y el profile, y registra auditoría en éxito', async () => {
    const { service, prisma, audit } = buildService({});

    const result = await service.submit(baseDto);

    expect(result.leadId).toBe('lead-1');
    expect(result.profile.recommendedSector).toBe('marketing');
    expect(prisma.orientadorLead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ analysisCount: 1 }) })
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'orientador_ia.intake' }));
  });

  it('rechaza con 503 si Claude no está configurado, sin crear el lead', async () => {
    const { service, prisma } = buildService({ claudeConfigured: false });

    await expect(service.submit(baseDto)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.orientadorLead.create).not.toHaveBeenCalled();
  });

  it(`rechaza con 429 al alcanzar el límite de ${ORIENTADOR_MAX_ANALYSES_PER_EMAIL} análisis`, async () => {
    const { service, prisma } = buildService({ priorCount: ORIENTADOR_MAX_ANALYSES_PER_EMAIL });

    await expect(service.submit(baseDto)).rejects.toBeInstanceOf(HttpException);
    expect(prisma.orientadorLead.create).not.toHaveBeenCalled();
  });

  it('si el análisis falla, el lead ya creado queda sin profile y se registra el error', async () => {
    const { service, prisma, audit } = buildService({
      analyzeImpl: vi.fn().mockRejectedValue(new Error('timeout de Claude'))
    });

    await expect(service.submit(baseDto)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.orientadorLead.create).toHaveBeenCalled();
    expect(prisma.orientadorProfile.create).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'orientador_ia.intake_error' }));
  });
});
