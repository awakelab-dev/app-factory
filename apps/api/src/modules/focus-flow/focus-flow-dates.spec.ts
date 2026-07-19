import { describe, expect, it } from 'vitest';
import { addDays, formatDateOnly, parseDateOnly, startOfDay } from './focus-flow-dates';

describe('startOfDay', () => {
  it('trunca a medianoche UTC', () => {
    const withTime = new Date('2026-07-19T14:32:00.000Z');
    expect(startOfDay(withTime).toISOString()).toBe('2026-07-19T00:00:00.000Z');
  });
});

describe('addDays', () => {
  it('suma días de calendario (positivo y negativo)', () => {
    const base = parseDateOnly('2026-07-19');
    expect(formatDateOnly(addDays(base, 1))).toBe('2026-07-20');
    expect(formatDateOnly(addDays(base, -1))).toBe('2026-07-18');
  });

  it('cruza el fin de mes correctamente', () => {
    expect(formatDateOnly(addDays(parseDateOnly('2026-07-31'), 1))).toBe('2026-08-01');
  });
});

describe('parseDateOnly / formatDateOnly', () => {
  it('son inversas para una fecha de calendario válida', () => {
    expect(formatDateOnly(parseDateOnly('2026-07-19'))).toBe('2026-07-19');
  });

  it('rechaza una fecha inválida', () => {
    expect(() => parseDateOnly('no-es-una-fecha')).toThrow(RangeError);
  });
});
