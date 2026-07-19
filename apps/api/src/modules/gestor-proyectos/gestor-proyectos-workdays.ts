/**
 * Cálculo de días hábiles (L-V) para sprints y proyecciones — reimplementado
 * en el backend (spec-tecnica.md "Abierto") a partir de `workDays`/
 * `addWorkDays`/`nextMonday` del prototipo, para que tablero y reportes usen
 * el mismo resultado sin depender de la hora/zona horaria del navegador de
 * cada usuario. Todas las fechas se tratan como días de calendario en UTC
 * (medianoche UTC), nunca como instantes — coincide con `@db.Date` en Prisma.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Trunca a medianoche UTC, descartando cualquier componente de hora. */
export function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(startOfDay(date).getTime() + days * MS_PER_DAY);
}

/** `getUTCDay()`: 0 = domingo, 6 = sábado. */
export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** El lunes de la semana de `from` si `from` ya es lunes; si no, el próximo lunes. */
export function nextMonday(from: Date): Date {
  const day = startOfDay(from);
  const weekday = day.getUTCDay();
  if (weekday === 1) return day;
  const daysUntilMonday = weekday === 0 ? 1 : 8 - weekday;
  return addDays(day, daysUntilMonday);
}

/**
 * La fecha del `workDays`-ésimo día hábil contando `start` como día 1 (si
 * `start` cae en fin de semana, cuenta como día 0: el primer día hábil real
 * es el siguiente lunes en adelante). `addWorkDays(lunes, 10)` da el viernes
 * de la semana siguiente (10 días hábiles = 2 semanas L-V), igual que el
 * prototipo.
 */
export function addWorkDays(start: Date, workDays: number): Date {
  let date = startOfDay(start);
  let count = isWeekend(date) ? 0 : 1;
  while (count < workDays) {
    date = addDays(date, 1);
    if (!isWeekend(date)) count += 1;
  }
  return date;
}

/** Días hábiles entre `start` y `end`, ambos inclusive (0 si `end` < `start`). */
export function workDaysBetween(start: Date, end: Date): number {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  if (endDay.getTime() < startDay.getTime()) return 0;

  let count = 0;
  let date = startDay;
  while (date.getTime() <= endDay.getTime()) {
    if (!isWeekend(date)) count += 1;
    date = addDays(date, 1);
  }
  return count;
}

/**
 * Días hábiles transcurridos entre `start` y `today`, acotados por `end`
 * (para proyecciones: nunca cuenta más allá del último día del sprint, y
 * nunca antes de que el sprint empiece).
 */
export function workDaysElapsed(start: Date, end: Date, today: Date): number {
  const startDay = startOfDay(start);
  const endDay = startOfDay(end);
  const todayDay = startOfDay(today);

  if (todayDay.getTime() < startDay.getTime()) return 0;
  const capped = todayDay.getTime() > endDay.getTime() ? endDay : todayDay;
  return workDaysBetween(startDay, capped);
}

/** Parsea una fecha de calendario `YYYY-MM-DD` como medianoche UTC (sin desfase de zona horaria). */
export function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Fecha inválida: "${value}"`);
  return date;
}

/** Formatea una fecha (o Date de Prisma `@db.Date`) como `YYYY-MM-DD`. */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
