/**
 * Helpers puros del módulo moodle-insights — separados de los servicios de
 * Nest para poder testearlos sin levantar DI ni mockear Prisma/fetch.
 */

/** Promedio de una lista de notas, ignorando nulls/undefined. null si no hay ninguna. */
export function average(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number');
  if (nums.length === 0) return null;
  const sum = nums.reduce((acc, n) => acc + n, 0);
  return sum / nums.length;
}

/** Moodle serializa booleanos como 0|1 y fechas como epoch en segundos (0 = sin fecha). */
export function moodleBoolean(value: number): boolean {
  return value === 1;
}

export function moodleDate(epochSeconds: number): Date | null {
  return epochSeconds > 0 ? new Date(epochSeconds * 1000) : null;
}
