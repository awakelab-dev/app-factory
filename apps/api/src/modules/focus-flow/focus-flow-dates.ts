/**
 * Fechas de calendario en UTC (medianoche UTC), nunca instantes — mismo
 * criterio que `@db.Date` en Prisma (`focus.tasks.task_date`) y que las
 * sesiones agregadas por día del dashboard/desempeño. Copia local mínima del
 * mismo patrón de `gestor-proyectos-workdays.ts`: este módulo se genera con
 * aislamiento estricto de carpeta (docs/04, paso 4), así que no importa
 * helpers de un módulo hermano — solo se duplica lo estrictamente necesario
 * aquí (no hace falta días hábiles/L-V, focus-flow es 7 días a la semana).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Trunca a medianoche UTC, descartando cualquier componente de hora. */
export function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(startOfDay(date).getTime() + days * MS_PER_DAY);
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
