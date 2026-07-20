import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@awk/auth';
import type { PrismaService } from '../../prisma/prisma.service';
import { FocusSettingsService } from './focus-flow-settings.service';

const user: AuthUser = { id: 'u-1', email: 'a@awakelab.dev', displayName: 'Ana', roles: ['user'] };

const settingsRow = {
  id: 's-1',
  userId: 'u-1',
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLongBreak: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
  notificationsEnabled: true,
  projectedFocusMinutesPerDay: 600,
  createdAt: new Date('2026-07-01'),
  updatedAt: new Date('2026-07-01')
};

function buildService() {
  const prisma = {
    focusSettings: { upsert: vi.fn().mockResolvedValue(settingsRow) }
  } as unknown as PrismaService;
  return { service: new FocusSettingsService(prisma), prisma };
}

describe('FocusSettingsService.getOrCreate', () => {
  it('hace upsert por userId con defaults y update vacío (lazy-create)', async () => {
    const { service, prisma } = buildService();
    const dto = await service.getOrCreate(user);

    expect(prisma.focusSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u-1' },
        create: expect.objectContaining({ userId: 'u-1', focusMinutes: 25, projectedFocusMinutesPerDay: 600 }),
        update: {}
      })
    );
    expect(dto.focusMinutes).toBe(25);
    expect(dto.projectedFocusMinutesPerDay).toBe(600);
  });
});

describe('FocusSettingsService.update', () => {
  it('aplica el patch tanto en create (si no existía) como en update', async () => {
    const { service, prisma } = buildService();
    await service.update(user, { focusMinutes: 30, autoStartFocus: true });

    expect(prisma.focusSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u-1' },
        create: expect.objectContaining({ userId: 'u-1', focusMinutes: 30, autoStartFocus: true }),
        update: { focusMinutes: 30, autoStartFocus: true }
      })
    );
  });

  it('aplica el patch de projectedFocusMinutesPerDay (change-3, meta personal en minutos)', async () => {
    const { service, prisma } = buildService();
    await service.update(user, { projectedFocusMinutesPerDay: 450 });

    expect(prisma.focusSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u-1' },
        create: expect.objectContaining({ userId: 'u-1', projectedFocusMinutesPerDay: 450 }),
        update: { projectedFocusMinutesPerDay: 450 }
      })
    );
  });
});
