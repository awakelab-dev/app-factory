# Spec técnica — `gestor-proyectos`

> Artefacto del pipeline de Fase 1 (docs/04, paso 2). Para revisión técnica (docs/05) antes de generación. Depende de las decisiones funcionales de `spec-funcional.md` (incluye preguntas abiertas todavía sin responder — ver esa spec antes de aprobar esta).

## Score de complejidad y por qué el gate es obligatorio

Obligatorio por docs/05 (aplica al menos uno, y en la práctica dos):

- **Primer módulo de este tipo/patrón**: tablero kanban, arrastrar-y-soltar, y una matriz de permisos por tarea (admin / creador / asignado) más fina que cualquier módulo existente — calibración necesaria aunque no cree RBAC nuevo.
- **Alcance parcialmente ambiguo señalado por el propio análisis**: la gestión de usuarios del prototipo se solapa con `core-admin` (ver "Reutilización del core" y las preguntas abiertas de la spec funcional) — no se resuelve unilateralmente aquí.

No aplica auto-aprobación por muestreo.

**Complejidad, en contraste con los dos módulos ya generados**: menor que `orientador-ia` en un eje (sin integración externa nueva, sin rol de manifest nuevo — reutiliza `admin`/`user` de core tal cual) pero similar en número de entidades nuevas (5: `Project`, `Sprint`, `Task`, `Subtask`, `Comment`) y con lógica de negocio no trivial (cálculo de días hábiles para sprints/proyecciones, matriz de permisos por acción).

## Reutilización del core (docs/02, docs/03, D-011) y de módulos existentes

Explorado antes de diseñar (antiduplicación, docs/04 `list_modules`): `apps/api/src/modules/` (`moodle-insights`, `orientador-ia`) y `apps/web/src/modules/` (`core-admin`, `factory-console`, `hello`, `moodle-insights`, `orientador-ia`). Ninguno cubre proyectos/tareas/kanban. Hallazgos relevantes:

- **Auth/RBAC — reutilización total, sin cambios de core**: `JwtAuthGuard`+`RolesGuard` globales, `@Public()`/`@Roles()` (D-011). Este módulo es el **primero que no declara ningún rol nuevo**: usa `admin`/`user`, que ya existen en el seed (`core.roles`). El manifest (`module.manifest.ts`) no necesita `requiredRoles` a nivel de módulo (visible para cualquier autenticado); las rutas de escritura administrativa usan `@Roles('admin')`.
- **Usuarios — reutilización parcial, con un límite explícito**: `core.users`/`core.roles`/`core.userRoles` ya existen; `GET /api/core/users` (`core-admin`, solo lectura, solo admin) ya sirve para poblar un selector de "asignar a" en la UI de tareas — **se reutiliza ese endpoint en vez de duplicar una consulta de usuarios dentro de `gestor-proyectos`**. Lo que el prototipo trae y **no** se reutiliza porque no existe todavía en core: crear/editar/eliminar usuario y asignar contraseña/rol. Este módulo **no implementa ese CRUD** (ver spec funcional, pregunta abierta 1) — si el gate decide que hace falta ahora, es una migración de `core-admin`/`core`, fuera de la carpeta de este módulo, con su propia revisión.
- **Auditoría**: se reutiliza `AuditService` (core) para altas/bajas de proyecto, cambios de estado de tarea y eliminaciones — mismo patrón que `orientador-ia` con sus leads.
- **Patrón de módulo**: mismo patrón D-011/D-022 que `moodle-insights`/`orientador-ia` — `apps/api/src/modules/gestor-proyectos/`, `apps/web/src/modules/gestor-proyectos/`, schema PG propio.

## Modelo de datos (schema PG `proyectos`)

Nombre de schema corto por dominio, igual criterio que `moodle` (de `moodle-insights`) y `orientador` (de `orientador-ia`): `proyectos`.

```
proyectos.projects
  id, name, description (nullable)
  created_by_id (uuid de core.users), created_at, updated_at

proyectos.sprints
  id, project_id (FK → projects)
  name, start_date, end_date (date, no timestamptz — son días de calendario, no eventos)
  created_at

proyectos.tasks
  id, project_id (FK → projects), sprint_id (FK → sprints, nullable si se permite backlog sin sprint — ver "Abierto")
  title, status (enum: iniciada | en_progreso | en_pausa | cancelada | finalizada)
  due_date (date)
  assignee_id (uuid de core.users), created_by_id (uuid de core.users)
  created_at, updated_at

proyectos.subtasks
  id, task_id (FK → tasks)
  title, done (bool), created_at

proyectos.comments
  id, task_id (FK → tasks)
  author_id (uuid de core.users), text, created_at
```

Los campos "uuid de core.users" (`created_by_id`, `assignee_id`, `author_id`) son referencias conceptuales, no relaciones Prisma cross-schema: mismo patrón ya establecido por `moodle.sync_runs.triggeredById` y `orientador.exports_log.adminUserId` (`String @db.Uuid`, sin `@relation` hacia `core.User`) — se resuelven a nivel de aplicación (join manual/lookup, no FK de base de datos), no se introduce aquí el primer caso de relación Prisma entre schemas de módulo y `core`. Las FK marcadas como "→ projects"/"→ tasks"/"→ sprints" sí son relaciones Prisma normales, por estar dentro del mismo schema `proyectos`.

Todas las tablas quedan protegidas por RBAC de endpoint + filtrado server-side por participación (ver "Lógica de permisos"); no se requiere Row-Level Security de Postgres (docs/05 la reserva para "confidencial" — este dato es "interno", incluso con el matiz de comentarios libres que podrían tocar info de cliente, mismo criterio que `orientador-ia` con sus leads: control a nivel de aplicación + auditoría, sin la capa extra de RLS).

## Endpoints (NestJS, `apps/api/src/modules/gestor-proyectos/`)

| Método/ruta | Acceso | Función |
|---|---|---|
| `GET /api/gestor-proyectos/dashboard` | autenticado | KPIs + "mis tareas" + atrasadas, ya filtrado server-side por lo que el usuario puede ver (evita traer todas las tareas de la plataforma al cliente solo para filtrarlas ahí, como hace el prototipo) |
| `GET /api/gestor-proyectos/projects` | autenticado | Admin: todos los proyectos; no-admin: solo donde participa (tiene ≥1 tarea asignada) |
| `POST /api/gestor-proyectos/projects` | `@Roles('admin')` | Crea proyecto + Sprint 1 automático (10 días hábiles desde el próximo lunes) |
| `DELETE /api/gestor-proyectos/projects/:id` | `@Roles('admin')` | Elimina proyecto (cascada a sprints/tareas/subtareas/comentarios) |
| `GET /api/gestor-proyectos/projects/:id` | autenticado, con chequeo de participación | Detalle + sprints |
| `POST /api/gestor-proyectos/projects/:id/sprints` | `@Roles('admin')` | Siguiente sprint (mismo cálculo de días hábiles que hoy) |
| `GET /api/gestor-proyectos/sprints/:id/tasks` | autenticado, con chequeo de participación | Tablero kanban del sprint |
| `POST /api/gestor-proyectos/tasks` | autenticado | Crea tarea; si el requester no es admin, `assignee_id` se fuerza a sí mismo (igual que `createTask()` del prototipo) |
| `PATCH /api/gestor-proyectos/tasks/:id/status` | autenticado, permiso `canChangeStatus` | Admin o asignado |
| `PATCH /api/gestor-proyectos/tasks/:id` | autenticado, permiso `canEditTask` | Admin, o creador==asignado==requester |
| `DELETE /api/gestor-proyectos/tasks/:id` | autenticado, permiso `canDeleteTask` | Admin, o creador==asignado==requester |
| `POST /api/gestor-proyectos/tasks/:id/subtasks` | autenticado, permiso `canAddInfo` | Admin o asignado |
| `PATCH /api/gestor-proyectos/subtasks/:id` | autenticado, permiso `canAddInfo` (de la tarea dueña) | Toggle `done` |
| `POST /api/gestor-proyectos/tasks/:id/comments` | autenticado, permiso `canAddInfo` | Admin o asignado |
| `GET /api/gestor-proyectos/reports?projectId=&sprintId=` | autenticado, con chequeo de participación | KPIs, proyección (real vs. esperado por días hábiles), desglose por estado y por persona — cálculo server-side reutilizando las mismas tareas que el tablero, sin endpoint aparte por métrica |

## Lógica de permisos (server-side — el hallazgo de seguridad más importante del prototipo)

El prototipo calcula `canChangeStatus`/`canAddInfo`/`canEditTask`/`canDeleteTask` **solo en el cliente** para decidir qué botón mostrar; nada impide que alguien llame a la función subyacente directamente desde la consola del navegador. La spec exige que **cada regla se reevalúe en el backend, en el servicio, no solo en el guard de rol**, porque son reglas de fila (¿soy el asignado de *esta* tarea?), no de rol:

- `participatesIn(user, projectId)`: admin siempre; si no, existe alguna tarea del proyecto con `assignee_id = user.id`.
- `canChangeStatus(user, task)`: `user.role === 'admin' || task.assigneeId === user.id`.
- `canAddInfo(user, task)`: igual que `canChangeStatus` (subtareas y comentarios).
- `canEditTask(user, task)`: `user.role === 'admin' || (task.createdById === user.id && task.assigneeId === user.id)`.
- `canDeleteTask(user, task)`: igual regla que `canEditTask`.

Un servicio (`GestorPermissionsService` o helpers puros reutilizados por todos los endpoints de tarea) centraliza estas reglas para que no se reimplementen distinto en cada controlador — mismo espíritu que `AuditService`/`RolesGuard`: la regla vive en un solo lugar.

## Frontend (`apps/web/src/modules/gestor-proyectos/`)

- Reutiliza `packages/ui` (shadcn/ui + tokens Awakelab) — sin marca externa que preservar (a diferencia de `orientador-ia`/D-028), se construye directo sobre el estilo de plataforma.
- **Arrastrar-y-soltar del kanban**: el prototipo ya lo implementa con la API nativa HTML5 Drag and Drop (`draggable`, `ondragstart`/`ondragover`/`ondrop`), sin librería. Se mantiene así en React (listeners nativos sobre los elementos) — **no se añade una dependencia nueva** (ej. `dnd-kit`) para esto; si más adelante se necesita reordenar dentro de una misma columna o soporte táctil serio, se reevalúa.
- Pantallas: `DashboardPage`, `ProjectsPage`, `ProjectDetailPage` (kanban + selector de sprint), `ReportsPage`, con modales de tarea/proyecto/sprint como componentes, no rutas separadas (igual que el prototipo).
- Sin pantalla de "Usuarios" propia (ver spec funcional, pregunta abierta 1); el selector de "asignar a" en el modal de tarea consume `GET /api/core/users` (ya existente, solo lectura) filtrando `isActive`.
- Sin login propio: el módulo vive detrás del shell autenticado estándar (mismo patrón que `moodle-insights`, sin rutas públicas — a diferencia de `orientador-ia`).

## Abierto (a resolver en el gate, no bloquea el diseño general)

- **`sprint_id` nullable en `tasks`**: el prototipo no permite crear tareas sin sprint (exige "crea primero un sprint"); se mantiene esa restricción (no nullable) salvo que el gate pida backlog sin sprint — ver spec funcional, pregunta 2/3.
- **Días hábiles**: se reimplementa el mismo cálculo L-V del prototipo (`workDays`/`addWorkDays`/`nextMonday`) en el backend en vez de en el cliente, para que proyecciones y duración de sprint sean consistentes entre el tablero y los reportes y no dependan de la hora/zona horaria del navegador de cada usuario.
- **Datos de ejemplo**: si el gate pide sembrar el equipo/proyectos de muestra del prototipo en staging (spec funcional, pregunta 4), se añade a `prisma/seed.ts` siguiendo el patrón ya usado para `orientador_admin`/academias — usuarios nuevos (Carla/Diego/María) como `user`, sin rol nuevo.
