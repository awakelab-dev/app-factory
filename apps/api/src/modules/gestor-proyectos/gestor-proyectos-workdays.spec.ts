import { describe, expect, it } from 'vitest';
import {
  addWorkDays,
  formatDateOnly,
  isWeekend,
  nextMonday,
  parseDateOnly,
  workDaysBetween,
  workDaysElapsed
} from './gestor-proyectos-workdays';

const MON = parseDateOnly('2026-07-20'); // lunes
const TUE = parseDateOnly('2026-07-21');
const FRI = parseDateOnly('2026-07-24');
const SAT = parseDateOnly('2026-07-25');
const SUN = parseDateOnly('2026-07-26');

describe('isWeekend', () => {
  it('reconoce sábado y domingo como fin de semana', () => {
    expect(isWeekend(SAT)).toBe(true);
    expect(isWeekend(SUN)).toBe(true);
  });

  it('reconoce cualquier día L-V como hábil', () => {
    expect(isWeekend(MON)).toBe(false);
    expect(isWeekend(FRI)).toBe(false);
  });
});

describe('nextMonday', () => {
  it('si ya es lunes, devuelve el mismo día', () => {
    expect(formatDateOnly(nextMonday(MON))).toBe('2026-07-20');
  });

  it('desde un martes, avanza al lunes siguiente', () => {
    expect(formatDateOnly(nextMonday(TUE))).toBe('2026-07-27');
  });

  it('desde un domingo, avanza un solo día', () => {
    expect(formatDateOnly(nextMonday(SUN))).toBe('2026-07-27');
  });

  it('desde un sábado, avanza al lunes siguiente', () => {
    expect(formatDateOnly(nextMonday(SAT))).toBe('2026-07-27');
  });
});

describe('addWorkDays', () => {
  it('10 días hábiles desde un lunes cae en el viernes de la semana siguiente (2 semanas L-V)', () => {
    expect(formatDateOnly(addWorkDays(MON, 10))).toBe('2026-07-31');
  });

  it('1 día hábil desde un lunes es el mismo lunes', () => {
    expect(formatDateOnly(addWorkDays(MON, 1))).toBe('2026-07-20');
  });

  it('si arranca en fin de semana, el primer día hábil es el lunes siguiente', () => {
    expect(formatDateOnly(addWorkDays(SAT, 1))).toBe('2026-07-27');
  });
});

describe('workDaysBetween', () => {
  it('cuenta ambos extremos inclusive, saltando fin de semana', () => {
    // lunes 20 a viernes 31 = 2 semanas completas L-V = 10 días hábiles
    expect(workDaysBetween(MON, parseDateOnly('2026-07-31'))).toBe(10);
  });

  it('devuelve 0 si el fin es anterior al inicio', () => {
    expect(workDaysBetween(FRI, MON)).toBe(0);
  });

  it('un solo día hábil cuenta 1', () => {
    expect(workDaysBetween(MON, MON)).toBe(1);
  });
});

describe('workDaysElapsed', () => {
  const start = MON; // 2026-07-20
  const end = parseDateOnly('2026-07-31'); // viernes semana 2

  it('antes de empezar el sprint, 0 días transcurridos', () => {
    expect(workDaysElapsed(start, end, parseDateOnly('2026-07-19'))).toBe(0);
  });

  it('a mitad de sprint, cuenta hasta hoy inclusive', () => {
    expect(workDaysElapsed(start, end, TUE)).toBe(2);
  });

  it('nunca cuenta más allá del fin del sprint', () => {
    expect(workDaysElapsed(start, end, parseDateOnly('2026-08-15'))).toBe(10);
  });
});

describe('parseDateOnly / formatDateOnly', () => {
  it('son inversas para una fecha de calendario válida', () => {
    expect(formatDateOnly(parseDateOnly('2026-07-20'))).toBe('2026-07-20');
  });

  it('rechaza una fecha inválida', () => {
    expect(() => parseDateOnly('no-es-una-fecha')).toThrow(RangeError);
  });
});
