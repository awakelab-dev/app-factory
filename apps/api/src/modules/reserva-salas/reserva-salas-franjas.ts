/**
 * Franjas horarias fijas de `reserva-salas` (spec-tecnica.md "Lógica de
 * negocio"): 7 valores, 09:00–13:00 y 16:00–17:00 — salta 14:00-15:59
 * (descanso/comida, igual que el prototipo). Única fuente de verdad: el
 * schema Zod de franja (`franjaSchema` en `reserva-salas.types.ts`) se deriva
 * de este array, así que añadir/quitar una franja solo se toca aquí.
 *
 * Helpers de fecha independientes del equivalente de `incidencias-aula`
 * (`incidencias-aula-dates.ts`): cada módulo generado es autocontenido
 * (D-011). Fechas de calendario tratadas siempre como medianoche UTC — mismo
 * motivo que `@db.Date` en Prisma: evita que dependan de la zona horaria de
 * quien reserva o consulta.
 */

export const FRANJAS = ['09:00', '10:00', '11:00', '12:00', '13:00', '16:00', '17:00'] as const;

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

/** `YYYY-MM-DD` de hoy en UTC — `now` inyectable para tests deterministas. */
export function todayDateOnly(now: Date = new Date()): string {
  return formatDateOnly(now);
}

/** `true` si `fecha` (`YYYY-MM-DD`) es estrictamente anterior a hoy (UTC).
 * Comparación lexicográfica de strings ISO — válida porque el formato tiene
 * ancho fijo (`YYYY-MM-DD` ordena igual que la fecha real que representa). */
export function isPastDate(fecha: string, now: Date = new Date()): boolean {
  return fecha < todayDateOnly(now);
}
