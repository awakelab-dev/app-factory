/**
 * Aulas de DEMOSTRACIÓN del prototipo original — datos INVENTADOS (gate
 * funcional, decisión 6): NINGÚN alumno ni aula real. Se siembran SOLO fuera
 * de producción.
 *
 * IMPORTANTE (límite de esta generación, docs/04 paso 4 — "solo puede tocar
 * las carpetas de su módulo"): este paso NO puede escribir en
 * `apps/api/prisma/seed.ts` (raíz del paquete, fuera de
 * `apps/api/src/modules/incidencias-aula/`). Este archivo solo EXPORTA los
 * datos; wirearlos de verdad — con el mismo guardarrail de "no producción"
 * que pide la nota del gate — es tarea del paso de integración humana
 * (mismo punto donde se registra el módulo en `AppModule` y en
 * `apps/web/src/modules/registry.ts`). El wiring esperado en
 * `apps/api/prisma/seed.ts` es, comentado hasta integrarlo a propósito para
 * que no se convierta en dato real por inercia (gate funcional, decisión 6):
 *
 * ```ts
 * // import { INCIDENCIAS_AULA_SEED_AULAS } from
 * //   '../src/modules/incidencias-aula/incidencias-aula-seed-data';
 * //
 * // if (process.env.NODE_ENV !== 'production') {
 * //   for (const nombre of INCIDENCIAS_AULA_SEED_AULAS) {
 * //     await prisma.aula.upsert({ where: { nombre }, update: {}, create: { nombre } });
 * //   }
 * // }
 * ```
 *
 * De la misma forma, los tres roles nuevos de este módulo
 * (`incidencias_docente`/`incidencias_coordinacion`/`incidencias_direccion`)
 * necesitan su propio `prisma.role.upsert(...)` en `seed.ts`, igual patrón
 * que `orientador_admin` — también pendiente de ese mismo paso de
 * integración, no de esta generación. En producción, la tabla `Aula` arranca
 * VACÍA y se puebla con la pantalla de gestión de `admin`
 * (`POST /api/incidencias-aula/aulas`).
 */
export const INCIDENCIAS_AULA_SEED_AULAS: readonly string[] = [
  '1º DAM - A',
  '1º DAM - B',
  '2º DAW',
  '1º SMR',
  '2º ASIR',
  '1º Marketing'
];
