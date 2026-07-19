# Spec técnica — `focus-flow`

> Artefacto del pipeline de Fase 1 (docs/04, paso 2). Para revisión técnica (docs/05) antes de generación. Depende de las decisiones funcionales de `spec-funcional.md` (incluye preguntas abiertas todavía sin responder — ver esa spec antes de aprobar esta).

## Score de complejidad y por qué el gate es obligatorio

Obligatorio por docs/05 (aplica más de un criterio):

- **Primer módulo de este tipo/patrón**: datos estrictamente personales/privados por usuario (sin vista de equipo ni de admin) — patrón no ejercitado antes, calibración necesaria aunque no introduce RBAC nuevo.
- **Alcance ambiguo señalado por el propio análisis**: alcance de usuarios (¿solo Leonardo o cualquier autenticado?) e integración con `gestor-proyectos` — ver preguntas abiertas de la spec funcional.
- **Posible dependencia externa nueva evitable**: Chart.js del prototipo vs. reutilizar `recharts` — a confirmar en el gate.

No aplica auto-aprobación por muestreo.

**Complejidad, en contraste con los módulos ya generados**: menor que `orientador-ia` (sin integración LLM, sin rol nuevo) y menor que `gestor-proyectos` (sin matriz de permisos por fila entre distintos usuarios — aquí la regla es una sola: dueño = `userId` del request, sin excepciones de admin/creador/asignado). Entidades nuevas: 3 (`FocusSettings`, `FocusTask`, `FocusSession`), la más pequeña de las tres hasta ahora. La complejidad real no está en el modelo de datos sino en el cálculo de agregados reales (pomodoros/minutos por día, racha de días consecutivos con actividad, distribución semanal) que hoy son constantes decorativas en el prototipo.

## Reutilización del core (docs/02, docs/03, D-011) y de módulos existentes

Explorado antes de diseñar (antiduplicación, docs/04 `list_modules`): `apps/api/src/modules/` (`gestor-proyectos`, `moodle-insights`, `orientador-ia`) y `apps/web/src/modules/` (`core-admin`, `factory-console`, `gestor-proyectos`, `hello`, `moodle-insights`, `orientador-ia`). Ningún módulo existente cubre temporizador Pomodoro / productividad personal. Hallazgo más cercano: `proyectos.Task` (`gestor-proyectos`) modela tareas de equipo dentro de proyecto+sprint con asignación y permisos por fila — **no encaja** con una lista de tareas personales del día sin proyecto/sprint ni con la mecánica de pomodoros por tarea; se trata como un dominio distinto (ver spec funcional, pregunta abierta 2, sobre si vale la pena integrarlos más adelante), no se reutiliza su tabla.

- **Auth/RBAC — reutilización total, sin cambios de core**: `JwtAuthGuard`+`RolesGuard` globales (D-011). Sin rol nuevo de manifest — cualquier autenticado (`user`/`admin`) accede al módulo; el control real no es de rol sino de **fila**: cada consulta/mutación se filtra siempre por `userId = request.user.id`, sin excepción ni para `admin` (a diferencia de `gestor-proyectos`, donde `admin` sí ve todo). Este es el primer módulo donde ni siquiera `admin` tiene una vista ampliada — confirmar en el gate que esto es lo deseado (spec funcional, pregunta 1).
- **Gráficos**: se reutiliza `recharts` (ya dependencia de `apps/web` desde `moodle-insights`) en vez de añadir Chart.js — sin dependencia nueva (pendiente de confirmación en el gate, spec funcional pregunta 3).
- **Auditoría**: `AuditService` (core) no aplica aquí con el mismo peso que en los otros módulos — no hay dato de un tercero ni acción administrativa sobre datos ajenos que auditar (cada usuario solo toca lo suyo). Se usa igualmente para altas/bajas de tarea, por consistencia con el resto de la plataforma, pero sin ser un requisito de gobernanza crítico como en `orientador-ia`/`gestor-proyectos`.
- **Patrón de módulo**: mismo patrón D-011/D-022 que los módulos anteriores — `apps/api/src/modules/focus-flow/`, `apps/web/src/modules/focus-flow/`, schema PG propio.

## Modelo de datos (schema PG `focus`)

Nombre de schema corto por dominio, mismo criterio que `moodle`/`orientador`/`proyectos`: `focus`.

```
focus.settings                 # una fila por usuario (creada perezosamente en el primer GET)
  id, user_id (uuid de core.users, unique)
  focus_minutes (default 25), short_break_minutes (default 5), long_break_minutes (default 15)
  rounds_before_long_break (default 4)
  auto_start_breaks (bool, default true), auto_start_focus (bool, default false)
  notifications_enabled (bool, default true)
  created_at, updated_at

focus.tasks
  id, user_id (uuid de core.users)
  title, estimated_pomodoros (int), completed_pomodoros (int, default 0)
  done (bool, default false)
  position (int, orden dentro del día — drag&drop)
  task_date (date, día al que pertenece — "hoy" es el filtro por defecto de la cola activa)
  created_at, updated_at

focus.sessions                 # fuente de verdad de las estadísticas reales (reemplaza los números decorativos)
  id, user_id (uuid de core.users)
  task_id (FK → focus.tasks, nullable — un descanso no tiene tarea)
  phase (enum: focus | short_break | long_break)
  started_at, completed_at (timestamptz)
  duration_seconds (duración real transcurrida — puede ser menor a la nominal si se "saltó" la fase)
  was_skipped (bool, default false)
  created_at
```

`user_id` es una referencia conceptual a `core.users` (uuid), no una relación Prisma cross-schema — mismo patrón ya establecido por `moodle.sync_runs.triggeredById`, `orientador.exports_log.adminUserId` y los `*_id` de `proyectos.tasks` (resuelto a nivel de aplicación, no FK de base de datos entre schemas).

Todas las tablas quedan protegidas por RBAC de endpoint (cualquier autenticado) + filtrado obligatorio por `user_id = request.user.id` en cada consulta/mutación del servicio — no se requiere Row-Level Security de Postgres (docs/05 la reserva para "confidencial"; este dato es personal del propio usuario que lo generó, control a nivel de aplicación es suficiente, mismo criterio que `orientador-ia`/`gestor-proyectos`). No se necesita auditoría de "acceso a dato de otro" porque, por diseño, nunca ocurre (ni `admin` puede consultar los datos de otro usuario en este módulo — ver spec funcional, pregunta 1, si eso cambiara sí haría falta revisar este punto).

## Endpoints (NestJS, `apps/api/src/modules/focus-flow/`)

Todos requieren autenticación (`user` o `admin`, sin `@Roles` restrictivo); todos filtran implícitamente por el `userId` del JWT — ningún endpoint acepta un `userId` como parámetro.

| Método/ruta | Función |
|---|---|
| `GET /api/focus-flow/settings` | Configuración del usuario (crea fila con defaults si no existe) |
| `PUT /api/focus-flow/settings` | Actualiza duración de fases, rondas, auto-arranque, notificaciones |
| `GET /api/focus-flow/tasks?date=YYYY-MM-DD` | Cola de tareas del día (por defecto, hoy) |
| `POST /api/focus-flow/tasks` | Crea tarea (título + estimado de pomodoros, se añade al final de la cola) |
| `PATCH /api/focus-flow/tasks/:id` | Editar (título/estimado), marcar completada, o reordenar (`position`) |
| `DELETE /api/focus-flow/tasks/:id` | Elimina tarea |
| `POST /api/focus-flow/sessions` | Registra una fase completada o saltada (el cliente sigue siendo la autoridad del conteo del timer, ver "Abierto"); si `phase=focus` y hay tarea actual, incrementa `completed_pomodoros` de esa tarea en la misma transacción |
| `GET /api/focus-flow/dashboard` | KPIs y series de "hoy": pomodoros completados, minutos de enfoque, tareas completadas/en curso/pendientes, distribución por franja horaria — **calculado de `focus.sessions`/`focus.tasks` reales**, ya no son constantes |
| `GET /api/focus-flow/performance?range=week\|month` | Series semanales/4-semanas (pomodoros por día, tasa de finalización, tendencia de "foco efectivo") + racha de días consecutivos con al menos una sesión de enfoque completada |

"Foco efectivo" (hoy un porcentaje inventado en el prototipo) se define para el MVP como `sesiones de enfoque completadas / (completadas + saltadas)` en el rango — a confirmar en el gate si esta definición es la deseada o si Leonardo tiene otra métrica en mente.

## Temporizador — qué vive en el cliente vs. qué se persiste (decisión de diseño)

El **conteo del timer en curso sigue siendo responsabilidad del cliente** (igual que hoy: `setInterval` de un segundo, anillo SVG) — no se migra a un timer server-authoritative para el MVP (evita websockets/polling y complejidad de sincronización de reloj). Lo que cambia respecto al prototipo:

- Al completar (o saltar) una fase, el cliente hace `POST /sessions` — este es el único punto de contacto con el backend durante el ciclo del timer, y es lo que corrige el hallazgo #2 de la spec funcional (estadísticas reales en vez de decorativas).
- Si la persona recarga la página **a mitad de un ciclo en curso**, ese ciclo se pierde (mismo comportamiento que hoy) — solo las fases ya completadas/saltadas y la cola de tareas persisten. Confirmar en el gate que esto es aceptable para el MVP (alternativa: guardar `started_at` al iniciar y reconstruir el tiempo restante al recargar — más simple de lo que parece, pero es una fase 2 razonable, no bloqueante).
- **Autoarranque de fases** (`auto_start_breaks`/`auto_start_focus`, spec funcional pregunta 4): si se confirma implementarlo de verdad, es lógica puramente de cliente (leer el setting tras `POST /sessions` y decidir si llama a `toggleTimer()` automáticamente o espera al clic) — no requiere cambios en el modelo de datos, ya está contemplado en `focus.settings`.
- **Notificaciones**: se mantiene la `Notification` API del navegador tal cual (sin cambios de arquitectura); `notifications_enabled` en `focus.settings` sustituye al interruptor que hoy no persiste.
- **Sonido al terminar**: fuera del MVP salvo que el gate lo pida explícitamente (spec funcional, pregunta 4) — no hay campo en el modelo de datos para esto todavía.

## Frontend (`apps/web/src/modules/focus-flow/`)

- Reutiliza `packages/ui` (shadcn/ui + tokens Awakelab) — sin marca externa que preservar, el prototipo ya usa la paleta/tipografía de plataforma tal cual (a diferencia de `orientador-ia`/D-028).
- **Arrastrar-y-soltar de la cola de tareas**: mismo criterio que `gestor-proyectos` — se mantiene con la API nativa HTML5 Drag and Drop, sin añadir `dnd-kit` ni otra librería.
- **Gráficos**: se migran de Chart.js a `recharts` (pendiente de confirmación, ver "Score de complejidad") — mismos tipos de visualización (línea, dona, barras) ya usados en `moodle-insights`, reutilizando el mismo criterio visual.
- Pantallas: `FocusPage` (timer + cola de hoy), `TasksPage` (planificación del día + resumen + estimación de cierre), `DashboardPage`, `PerformancePage`, `SettingsPage` — mismo agrupamiento de navegación que el prototipo (Trabajo / Análisis / Sistema).
- Sin pantalla de administración ni selector de usuario — no existe ese concepto en este módulo (spec funcional, pregunta 1).
- Sin rutas públicas — vive detrás del shell autenticado estándar (mismo patrón que `moodle-insights`/`gestor-proyectos`, a diferencia de `orientador-ia`).

## Abierto (a resolver en el gate, no bloquea el diseño general)

- **Alcance de usuarios** (spec funcional, pregunta 1): si el gate decide que es "solo Leonardo" en vez de "cualquier autenticado", la implementación no cambia (sigue siendo `userId = request.user.id` sin rol nuevo) — solo cambiaría a quién se le da de alta la cuenta/rol para usarlo, no el diseño técnico.
- **Integración con `gestor-proyectos`** (spec funcional, pregunta 2): si se aprueba más adelante, el diseño más simple es un endpoint de solo lectura en `gestor-proyectos` (`GET .../mis-tareas`) que `focus-flow` consuma para *sugerir* altas en `focus.tasks` (copia, no referencia viva) — evita una FK cross-módulo y mantiene ambos schemas independientes; no se diseña en detalle hasta que se apruebe la integración.
- **Recuperar el timer tras recargar a mitad de ciclo**: no incluido en el MVP (ver arriba) — si se pide, es aditivo (`started_at` ya se puede derivar del primer `POST /sessions` pendiente o un endpoint `POST /sessions/start` nuevo).
- **Definición exacta de "foco efectivo"** y de "racha de días" (¿cuenta un día con una sola sesión de enfoque, o hay un mínimo?) — propuesta arriba, a confirmar.
