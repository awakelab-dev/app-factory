# Mini-spec técnica — cambio 2: priorización en la bandeja de coordinación

> Delta sobre `spec-tecnica.md` del módulo `incidencias-aula` (vigente, no se
> repite aquí). Alcance: únicamente `GET /api/incidencias-aula/incidencias`
> (bandeja de coordinación) y `CoordinacionPage`. Ningún otro endpoint,
> pantalla, rol o modelo se toca.

## Impacto de migración: ninguno

No se añade columna, tabla ni enum. "Días abierta" se deriva en memoria de
`createdAt`/`cerradaAt`, campos que ya existen en `Incidencia` desde el módulo
original. Cero downtime, sin backfill, sin cambio en `schema.prisma`.

## Backend (`apps/api/src/modules/incidencias-aula/`)

### `incidencias-aula.types.ts`

- `bandejaFiltrosSchema`: añade `gravedad: incidenciaGravedadSchema.optional()`.
  `BandejaFiltros` queda `{ estado?, aulaId?, gravedad? }`.
- Nuevo `incidenciaBandejaRowSchema = incidenciaRowSchema.extend({ diasAbierta: z.number().int() })`
  y su tipo `IncidenciaBandejaRow`, exportado junto al resto. **No se modifica
  `incidenciaRowSchema`** (lo comparten `mias`, `detail` y el docente) — el
  campo nuevo solo existe en la forma de respuesta de la bandeja, para no
  arrastrar un campo irrelevante a la vista del docente ni obligar a tocar su
  contrato. Mismo criterio de aislamiento que ya usa `ResumenMensualDetalleFila`
  frente a `IncidenciaRow`.
- `GET /api/incidencias-aula/incidencias` cambia su tipo de respuesta de
  `IncidenciaRow[]` a `IncidenciaBandejaRow[]` (único endpoint cuyo contrato
  cambia).

### `incidencias-aula.controller.ts`

- `bandeja()`: añade `@Query('gravedad', new ZodValidationPipe(incidenciaGravedadSchema.optional())) gravedad?: IncidenciaGravedad`
  y lo pasa a `incidenciasService.bandeja(user, { estado, aulaId, gravedad })`
  (mismo patrón que el `@Query('estado', ...)` ya existente).

### `incidencias-aula-incidencias.service.ts`

- `bandeja(user, filtros)`:
  - `where` de Prisma añade `gravedad: filtros.gravedad` (mismo patrón que
    `estado`/`aulaId`, Prisma ignora la clave si es `undefined`).
  - Tras `toRowsWithAulaNames` (o una variante para la bandeja), calcula
    `diasAbierta` por fila reutilizando `daysBetween` de
    `incidencias-aula-dates.ts`: `Math.floor(daysBetween(row.createdAt, row.estado === 'cerrada' && row.cerradaAt ? row.cerradaAt : now))`,
    con `now = new Date()` (parámetro inyectable con default, mismo criterio
    que `currentMonth(now: Date = new Date())` en el mismo archivo, para poder
    testear con fecha fija).
  - Orden: si `filtros.estado !== 'cerrada'` (incluye `undefined`), ordenar el
    array resultante por `diasAbierta` descendente **en memoria**, después del
    fetch — Prisma no puede ordenar por un campo calculado sin SQL crudo, y no
    se justifica introducirlo para esto (mismo espíritu que
    `toRowsWithAulaNames`, que ya post-procesa filas tras el fetch). Si
    `filtros.estado === 'cerrada'`, se mantiene `orderBy: { createdAt: 'desc' }`
    sin cambios (comportamiento actual, sin alterar).
  - Nueva función privada `toBandejaRowsWithAulaNames` (o extensión de
    `toRowsWithAulaNames` con un parámetro `now`) que construye
    `IncidenciaBandejaRow[]` en vez de `IncidenciaRow[]`. `listMias` sigue
    usando la variante existente sin `diasAbierta` — no se toca.

No hay cambios en `IncidenciasPermissionsService`, `IncidenciasResumenService`,
`IncidenciasAulasService`, ni en ningún otro endpoint del controller.

## Frontend (`apps/web/src/modules/incidencias-aula/`)

### `incidencias-aula.types.ts` (espejo del backend, mismo criterio VINCULANTE ya vigente de no tocar `@awk/types`)

- Añade `incidenciaGravedadSchema` ya existe; añade
  `incidenciaBandejaRowSchema`/`IncidenciaBandejaRow` espejo exacto del
  backend.

### `incidencias-labels.ts`

- Añade constante exportada `DIAS_ALERTA_ESTANCAMIENTO = 7` — único lugar
  donde vive el umbral, para no duplicarlo si en el futuro se reutiliza en
  otra pantalla.

### `CoordinacionPage.tsx`

- `filters` pasa a `{ estado?: EstadoIncidencia; aulaId?: string; gravedad?: IncidenciaGravedad }`.
- `buildQuery` añade `if (filters.gravedad) params.set('gravedad', filters.gravedad)`.
- Nuevo `<select data-testid="filtro-gravedad">` junto a los `<select>` de
  estado/aula ya existentes, mismas clases (`fieldClass`) y mismo patrón de
  opciones (`Object.entries(GRAVEDAD_LABEL)`, ya importado e ya usado en la
  columna de gravedad de la propia tabla).
- El fetch de la tabla pasa de `incidenciasResponseSchema` a un nuevo
  `incidenciasBandejaResponseSchema` (`z.array(incidenciaBandejaRowSchema)`).
  El fetch de KPIs (`allRows`) **no cambia** — sigue sobre bandeja completa sin
  filtrar y sin necesitar `diasAbierta`.
- Tabla: nueva columna "Días abierta" (`<td>{row.diasAbierta}</td>`) entre
  "Fecha" y "Estado" (o al final — detalle de maquetación libre para
  generación, no hay preferencia funcional).
- Marca visual: la fila (o la celda de días) recibe una clase/estilo distinto
  cuando `(row.estado === 'abierta' || row.estado === 'en_curso') && row.diasAbierta > DIAS_ALERTA_ESTANCAMIENTO` —
  reutiliza el icono `AlertTriangle` ya importado (usado hoy en el KPI
  "Gravedad alta") en vez de introducir un icono nuevo. No se toca
  `ESTADO_ACCENT`/`ESTADO_LABEL` — el badge de estado sigue mostrando
  exactamente los tres valores actuales, sin un cuarto valor "estancada".
- No se cambia el `orderBy` en el cliente: la tabla sigue pintando el array tal
  como llega de la API (el orden lo decide el backend según la sección
  "Orden" de arriba); el frontend no reordena.

### Sin cambios

`DocentePage.tsx`, `DireccionPage.tsx`, `AulasAdminPage.tsx`, `index.tsx`,
`module.manifest.ts` — ningún rol, ruta de navegación ni pantalla adicional.

## Tests a actualizar (delta)

- `incidencias-aula-incidencias.service.spec.ts`: casos nuevos — filtro por
  `gravedad` solo y combinado con `estado`/`aulaId`; `diasAbierta` correcto
  para una incidencia abierta (respecto a `now` inyectado) y para una cerrada
  (respecto a `cerradaAt`, no a `now`); orden descendente por `diasAbierta`
  cuando `estado` es `undefined`/`abierta`/`en_curso`; orden sin cambios
  (por `createdAt`) cuando `estado === 'cerrada'`.
- `CoordinacionPage.test.tsx`: filtro de gravedad visible y combinable;
  columna "Días abierta" presente en la tabla; marca visual presente en una
  fila `abierta`/`en_curso` con `diasAbierta > 7` y ausente si `<= 7` o si
  `cerrada`.
- Sin cambios en `DocentePage.test.tsx`, `DireccionPage.test.tsx`,
  `AulasAdminPage.test.tsx`, `incidencias-aula-permissions.service.spec.ts`,
  `incidencias-aula-resumen.service.spec.ts`.

## Reutilización explícita

- `daysBetween` (`incidencias-aula-dates.ts`) — ya existe, se reutiliza tal
  cual, mismo criterio de días naturales que usa `IncidenciasResumenService`
  para `diasHastaCierre`.
- Patrón de filtro `<select>` (`fieldClass`, `data-testid`, `Object.entries(*_LABEL)`)
  ya usado por los filtros de estado/aula — se replica para gravedad sin
  introducir un componente nuevo.
- `GRAVEDAD_LABEL`/`AlertTriangle` ya existen y ya se usan en `CoordinacionPage`
  — se reutilizan, no se añade dependencia nueva.
- Aislamiento de DTO (`IncidenciaBandejaRow` extiende sin modificar
  `IncidenciaRow`) — mismo criterio que ya separa `ResumenMensualDetalleFila`
  de `IncidenciaRow` para no filtrar/mezclar contratos entre vistas de
  distintos roles.

## Sin dependencias nuevas, sin roles nuevos, sin endpoints nuevos

Un único endpoint cambia de contrato (`GET .../incidencias`, añade query param
y un campo de respuesta). No hay `npm install` nuevo, no hay rol de manifest
nuevo, no hay ruta nueva en `module.manifest.ts`.
