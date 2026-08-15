import type { ModuleManifest } from '@awk/types';

/**
 * Registro de Incidencias de Aula (spec-tecnica.md `incidencias-aula`,
 * docs/pipeline/incidencias-aula/): caso INTERNO de Awakelab (gate funcional,
 * decisión 1 — no encargo de cliente, nombres de rol genéricos SIN prefijo).
 * Tres roles de manifest nuevos con capacidades DISJUNTAS sobre la misma
 * entidad (D-011): `incidencias_docente` (alta + lista propia),
 * `incidencias_coordinacion` (bandeja completa) e `incidencias_direccion`
 * (resumen mensual minimizado, solo agregados — nunca alumno/relato). `admin`
 * se agrega a los tres para que cualquier admin de plataforma entre sin
 * necesitar altas manuales de rol (mismo criterio que `orientador_admin` en
 * `orientador-ia`). La gestión del catálogo de aulas (gate funcional,
 * decisión 4) es SOLO admin — por eso el ítem "Aulas" no lista
 * `incidencias_coordinacion`/`incidencias_direccion`.
 *
 * NOTA (docs/04, paso 4 — "solo puede tocar las carpetas de su módulo"): este
 * manifest todavía no está registrado en `apps/web/src/modules/registry.ts`
 * ni el módulo de Nest en `apps/api/src/app.module.ts` — ese cableado cruza
 * fuera de esta carpeta y queda para el paso de integración/PR review.
 */
export const incidenciasAulaManifest: ModuleManifest = {
  id: 'incidencias-aula',
  name: 'Registro de Incidencias de Aula',
  description: 'Registro y seguimiento de incidencias de aula de un centro de FP',
  basePath: '/incidencias-aula',
  requiredRoles: ['incidencias_docente', 'incidencias_coordinacion', 'incidencias_direccion', 'admin'],
  nav: [
    {
      label: 'Registrar incidencia',
      path: '/incidencias-aula',
      requiredRoles: ['incidencias_docente', 'admin'],
      icon: 'FileWarning'
    },
    {
      label: 'Bandeja',
      path: '/incidencias-aula/bandeja',
      requiredRoles: ['incidencias_coordinacion', 'admin'],
      icon: 'Inbox'
    },
    {
      label: 'Resumen mensual',
      path: '/incidencias-aula/resumen',
      requiredRoles: ['incidencias_direccion', 'admin'],
      icon: 'BarChart3'
    },
    {
      label: 'Aulas',
      path: '/incidencias-aula/aulas',
      requiredRoles: ['admin'],
      icon: 'DoorOpen'
    }
  ]
};
