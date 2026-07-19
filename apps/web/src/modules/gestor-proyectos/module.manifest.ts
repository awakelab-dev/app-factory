import type { ModuleManifest } from '@awk/types';

/**
 * Tablero kanban de proyectos/sprints/tareas de uso interno de Awakelab
 * (spec-tecnica.md `gestor-proyectos`, docs/pipeline/gestor-proyectos/):
 * primer módulo de este tipo (kanban + arrastrar-y-soltar + matriz de
 * permisos por tarea), sin rol de manifest nuevo — reutiliza `admin`/`user`
 * de core tal cual (D-011), a diferencia de `orientador-ia`
 * (`orientador_admin`). Sin `requiredRoles` a nivel de módulo: visible para
 * cualquier autenticado; las acciones administrativas (crear/eliminar
 * proyecto, crear sprint) están detrás de `@Roles('admin')` en la API, no
 * aquí — el filtrado del shell nunca es el único control de permisos.
 *
 * NOTA (docs/04, paso 4 — "Solo puede tocar las carpetas de su módulo"): este
 * manifest todavía no está registrado en `apps/web/src/modules/registry.ts`
 * ni el módulo de Nest en `apps/api/src/app.module.ts` — ese cableado
 * cruza fuera de esta carpeta y queda para el paso de integración/PR review.
 */
export const gestorProyectosManifest: ModuleManifest = {
  id: 'gestor-proyectos',
  name: 'Gestor de Proyectos',
  description: 'Tablero kanban de proyectos, sprints y tareas (uso interno de Awakelab)',
  basePath: '/gestor-proyectos',
  nav: [
    { label: 'Gestor de Proyectos', path: '/gestor-proyectos', icon: 'KanbanSquare' },
    { label: 'Proyectos', path: '/gestor-proyectos/projects', icon: 'FolderKanban' }
  ]
};
