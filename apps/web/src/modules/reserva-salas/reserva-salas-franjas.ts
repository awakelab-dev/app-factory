/**
 * Franjas horarias fijas de `reserva-salas` — espejo EXACTO de
 * `apps/api/src/modules/reserva-salas/reserva-salas-franjas.ts` (gate técnico,
 * nota VINCULANTE: los esquemas/constantes quedan locales a cada lado, mismo
 * criterio que el resto de módulos generados — D-011, este módulo no puede
 * tocar `@awk/types` en este paso de generación).
 */
export const FRANJAS = ['09:00', '10:00', '11:00', '12:00', '13:00', '16:00', '17:00'] as const;

/** `YYYY-MM-DD` de hoy — usado como valor por defecto y `min` del date picker
 * (spec-funcional.md, flujo Empleado: "selector de día, hoy en adelante"). */
export function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}
