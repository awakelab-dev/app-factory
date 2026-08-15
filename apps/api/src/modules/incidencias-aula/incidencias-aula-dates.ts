/**
 * Helpers de fecha de `incidencias-aula`. Independiente del equivalente de
 * `gestor-proyectos` (`gestor-proyectos-workdays.ts`): cada módulo generado
 * es autocontenido (D-011) y aquí no hace falta noción de días HÁBILES (el
 * "tiempo hasta cierre" de una incidencia de convivencia se cuenta en días
 * naturales, no laborables). Fechas de calendario tratadas siempre como
 * medianoche UTC — mismo motivo que `@db.Date` en Prisma: evita que dependan
 * de la zona horaria de quien registra/consulta.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parsea una fecha de calendario `YYYY-MM-DD` como medianoche UTC. */
export function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Fecha inválida: "${value}"`);
  return date;
}

/** Formatea una fecha (o Date de Prisma `@db.Date`) como `YYYY-MM-DD`. */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Días naturales (con fracción) entre dos instantes — `to` puede tener hora. */
export function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MS_PER_DAY;
}

/** [inicio, fin) del mes de calendario `YYYY-MM` en UTC — `fin` es exclusivo
 * (el día 1 del mes siguiente), listo para un filtro Prisma `gte`/`lt`. */
export function parseMonth(mes: string): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!match) throw new RangeError(`Formato de mes inválido: "${mes}" (esperado YYYY-MM)`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new RangeError(`Formato de mes inválido: "${mes}" (esperado YYYY-MM)`);

  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1))
  };
}

/** `YYYY-MM` del mes en curso (UTC). */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}
