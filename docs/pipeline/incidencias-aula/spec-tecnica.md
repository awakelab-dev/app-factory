# Spec técnica — `incidencias-aula`

> Artefacto del pipeline (docs/04, paso 2). Para revisión técnica (docs/05) antes de generación. Depende de las decisiones funcionales de `spec-funcional.md` — varias preguntas abiertas allí (propiedad del centro, catálogos, partición de coordinación) condicionan detalles de esta spec marcados como "pendiente de gate".

## Score de complejidad y por qué el gate es obligatorio

Obligatorio por docs/05 (cumple varios criterios simultáneos):

- Datos personales/RGPD: nombre de alumno, relato de conducta, seguimiento y resolución — declarado por el manifest (`datos_personales`) y confirmado por el análisis, no rebajado.
- Primer módulo de este tipo: tres roles con capacidades disjuntas sobre la misma entidad, incluyendo un rol (`incidencias_direccion`) que accede a agregados del mismo dato que otros ven en detalle pero con minimización de campos a nivel de servidor (nunca sirve `alumnoNombre` ni `relato` a ese rol) — patrón no ejercitado antes en la plataforma.
- Alcance ambiguo: propiedad del centro/cliente y diseño de catálogos (ver `spec-funcional.md`, "Preguntas abiertas").
- Tres roles de manifest nuevos en un solo módulo (`incidencias_docente`, `incidencias_coordinacion`, `incidencias_direccion`) — más que cualquier módulo anterior (uno solo en `orientador-ia`, ninguno en `gestor-proyectos`/`focus-flow`).

No aplica auto-aprobación por muestreo.

## Reutilización del core y de otros módulos (docs/02, docs/03, D-011)

Explorado `apps/api/src/modules/` (`focus-flow`, `gestor-proyectos`, `moodle-insights`, `orientador-ia`) y `apps/web/src/modules/` (los mismos + `core-admin`, `factory-console`) antes de diseñar: **ningún módulo existente cubre registro/seguimiento de incidencias de conducta o convivencia — no hay duplicación de dominio** (antiduplicación, docs/04 `list_modules`).

- **Auth/RBAC**: se reutiliza `JwtAuthGuard`/`RolesGuard`/`@Roles()` sin cambios de core (D-011). **Sin `@Public()`**: a diferencia de `orientador-ia`, este módulo no tiene ningún flujo sin login — los tres roles son personal del centro con cuenta en la plataforma.
- **Roles de manifest nuevos** (mismo mecanismo que `orientador_admin`, D-011 — el manifest es el único lugar donde se declara un rol nuevo, sin tocar `packages/auth`): `incidencias_docente`, `incidencias_coordinacion`, `incidencias_direccion`. Se declaran tres en vez de uno porque, a diferencia de `orientador-ia` (un solo rol `orientador_admin` con acceso total al panel), aquí las tres vistas tienen capacidades **disjuntas y mutuamente excluyentes** sobre la misma entidad — nombrar un solo rol "admin del módulo" obligaría a resolver esa exclusión fuera del sistema de roles. Los usuarios de este centro se siembran/asignan por Sistemas (mismo procedimiento que Aspasia en `orientador-ia`), acotados a este módulo — no ven el resto de la plataforma salvo que además tengan `admin`.
- **Patrón de permisos por fila, no solo por rol**: se replica el criterio de `GestorPermissionsService` (`apps/api/src/modules/gestor-proyectos/gestor-proyectos-permissions.service.ts`) — el `RolesGuard` decide si el rol puede llegar al endpoint, pero un servicio de permisos centralizado (`IncidenciasPermissionsService`) decide si ESTA fila es visible/accionable para ESTE usuario (docente: solo si `docenteId === user.id`; coordinación: cualquiera). Nunca se confía en el rol solo para ocultar/mostrar botones en el cliente, mismo hallazgo de seguridad que motivó ese servicio en `gestor-proyectos`.
- **Minimización de campos para Dirección**: no existe precedente exacto en la plataforma (ni `orientador-ia` ni `gestor-proyectos` restringen columnas por rol sobre la misma entidad, solo filas). Se resuelve con un mapper de solo-agregado (`toResumenMensualDto`) que nunca instancia `alumnoNombre` ni `relato` ni `seguimientos` en el objeto de respuesta — no es un filtro de presentación en el frontend, es una forma de DTO distinta construida server-side, para que un fallo de UI no filtre el dato.
- **Sin RLS de Postgres**: mismo criterio que `orientador-ia` — el dato es "datos personales" (no "confidencial" en el sentido de docs/05), el control es RBAC de endpoint + permisos por fila en el servicio + auditoría, sin la capa adicional de Row-Level Security.
- **Auditoría**: se reutiliza `AuditService` (core) para accesos de `incidencias_coordinacion` al detalle de una incidencia (dato personal, mismo patrón que el acceso a `leads` en `orientador-ia`), y para las acciones de creación/cierre.
- **Patrón de módulo**: mismo patrón D-011/D-022 — carpeta propia `apps/api/src/modules/incidencias-aula/`, `apps/web/src/modules/incidencias-aula/`, schema PG propio `incidencias` (multiSchema, junto a `core`/`moodle`/`orientador`/`proyectos`/`focus`).
- **No se reutiliza `moodle-insights`** para el catálogo de aulas en este MVP (aunque conceptualmente `moodle.courses` ya modela grupos) — acoplar este módulo a que el centro tenga Moodle sincronizado es una decisión de alcance mayor, no asumida aquí; queda como pregunta abierta 4 de `spec-funcional.md`.
- **Sin dependencias externas nuevas**: a diferencia de `orientador-ia` (API de Claude) o `moodle-insights` (Moodle Web Services), este módulo no llama a ningún sistema externo.
- **Sin migración a `core`**: el único punto de contacto con `core` es `docenteId`/`autorId`/`cerradaPorId` guardados como UUID sin FK cross-schema (mismo criterio que `focus.tasks`/`proyectos.tasks`: `userId` de `core.users` sin relación Prisma cross-schema).

## Modelo de datos (schema PG `incidencias`)

```prisma
enum IncidenciaTipo {
  convivencia
  retraso_reiterado
  material_danado
  ausencia_injustificada
  uso_indebido_dispositivos
  otro
}

enum IncidenciaGravedad {
  baja
  media
  alta
}

enum EstadoIncidencia {
  abierta
  en_curso
  cerrada
}

model Aula {
  id        String   @id @default(uuid(7)) @db.Uuid
  nombre    String   @unique
  activa    Boolean  @default(true)
  createdAt DateTime @default(now())

  incidencias Incidencia[]

  @@map("aulas")
  @@schema("incidencias")
}
// Seeded con las 6 aulas de demo del prototipo (idempotente, mismo criterio que
// orientador.academies). Sin endpoint de alta/edición en este MVP — pendiente
// de gate (spec-funcional.md, pregunta abierta 4); añadirlo después es aditivo.

model Incidencia {
  id            String             @id @default(uuid(7)) @db.Uuid
  alumnoNombre  String
  aulaId        String             @db.Uuid
  aula          Aula               @relation(fields: [aulaId], references: [id])
  tipo          IncidenciaTipo
  gravedad      IncidenciaGravedad
  fechaHecho    DateTime           @db.Date
  relato        String             @db.Text
  docenteId     String             @db.Uuid  // core.users.id, sin FK cross-schema
  estado        EstadoIncidencia   @default(abierta)
  resolucion    String?            @db.Text
  cerradaAt     DateTime?
  cerradaPorId  String?            @db.Uuid  // core.users.id de coordinación
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

  seguimientos IncidenciaSeguimiento[]

  @@index([docenteId])
  @@index([estado])
  @@index([aulaId])
  @@map("incidencias")
  @@schema("incidencias")
}

model IncidenciaSeguimiento {
  id           String     @id @default(uuid(7)) @db.Uuid
  incidenciaId String     @db.Uuid
  incidencia   Incidencia @relation(fields: [incidenciaId], references: [id], onDelete: Cascade)
  autorId      String     @db.Uuid  // core.users.id de coordinación
  texto        String     @db.Text
  createdAt    DateTime   @default(now())

  @@index([incidenciaId])
  @@map("incidencia_seguimientos")
  @@schema("incidencias")
}
```

`IncidenciaTipo` se modela como enum Prisma (catálogo cerrado, coherente con el prototipo) — pendiente de la pregunta abierta 3 de `spec-funcional.md`; si el gate pide un catálogo editable, se migra a una tabla `Tipo` con el mismo patrón que `Aula`, cambio aditivo que no afecta el resto del diseño.

## Endpoints (NestJS, `apps/api/src/modules/incidencias-aula/`)

| Método/ruta | Acceso | Función |
|---|---|---|
| `POST /api/incidencias-aula/incidencias` | `@Roles('incidencias_docente','admin')` | Crea la incidencia con `docenteId = request.user.id`; estado inicial `abierta` |
| `GET /api/incidencias-aula/incidencias/mias` | `@Roles('incidencias_docente','admin')` | Lista las incidencias creadas por el propio usuario (`docenteId = request.user.id`) |
| `GET /api/incidencias-aula/incidencias/:id` | `@Roles('incidencias_docente','incidencias_coordinacion','admin')` | Detalle completo (alumno, relato, seguimiento). Regla de fila en `IncidenciasPermissionsService`: docente solo si es su incidencia (403 si no); coordinación/admin, cualquiera. Dispara auditoría si el actor es coordinación/admin |
| `GET /api/incidencias-aula/incidencias` | `@Roles('incidencias_coordinacion','admin')` | Bandeja completa con filtros `estado`/`aulaId` |
| `POST /api/incidencias-aula/incidencias/:id/tomar` | `@Roles('incidencias_coordinacion','admin')` | Solo si `estado='abierta'`; pasa a `en_curso` y crea un `IncidenciaSeguimiento` automático ("Caso tomado por coordinación") |
| `POST /api/incidencias-aula/incidencias/:id/seguimiento` | `@Roles('incidencias_coordinacion','admin')` | Añade una entrada de seguimiento (`texto` no vacío); si el estado era `abierta` pasa a `en_curso`. Rechaza si `estado='cerrada'` |
| `POST /api/incidencias-aula/incidencias/:id/cerrar` | `@Roles('incidencias_coordinacion','admin')` | Exige `resolucion` no vacía (DTO Zod `min(1)`, mismo criterio de validación obligatoria que el modal del prototipo); setea `cerradaAt`/`cerradaPorId`; rechaza si ya estaba `cerrada` |
| `GET /api/incidencias-aula/aulas` | `@Roles('incidencias_docente','incidencias_coordinacion','incidencias_direccion','admin')` | Catálogo de aulas activas, para el formulario del docente y los filtros de coordinación |
| `GET /api/incidencias-aula/resumen-mensual?mes=YYYY-MM` | `@Roles('incidencias_direccion','admin')` | Agregados del mes: total, abiertas, días medios hasta cierre, distribución por tipo y por aula, y detalle **sin** `alumnoNombre`/`relato`/`seguimientos` (DTO `ResumenMensualDto` construido por un mapper propio que nunca toca esos campos) |

`IncidenciaTipo`/`IncidenciaGravedad`/`EstadoIncidencia` se exportan como enums Zod en `@awk/types` (`incidenciaTipoSchema`, etc.) y el frontend los consume directamente — no hay endpoint de catálogo para tipos/gravedad/estado (son valores fijos del contrato, mismo criterio que `focus.settings` con sus enums).

## Reglas de permiso por fila (`IncidenciasPermissionsService`)

Mismo espíritu que `GestorPermissionsService` — centralizadas en un servicio, reevaluadas en cada endpoint, nunca solo en el guard de rol ni en el cliente:

- `canViewDetail(user, incidencia)`: `admin` → sí; `incidencias_coordinacion` → sí; `incidencias_docente` → solo si `incidencia.docenteId === user.id`.
- `canAct(user)` (tomar/seguimiento/cerrar): `admin` o `incidencias_coordinacion`.
- Cierre: además de `canAct`, el DTO de entrada exige `resolucion` no vacía — el prototipo ya bloquea el cierre sin resolución en cliente; aquí se repite la validación en el backend (Zod), igual que el resto de la plataforma nunca confía solo en la validación de formulario.

## Frontend (`apps/web/src/modules/incidencias-aula/`)

Reutiliza `packages/ui` (shadcn/ui + tokens Awakelab) en vez del CSS a medida del prototipo — reimplementación de las pantallas sobre componentes de plataforma, no copia del HTML/JS del prototipo tal cual (mismo criterio que `orientador-ia`).

- `DocentePage` (`/incidencias-aula`): formulario de alta + tabla de "mis incidencias" + modal de detalle de solo lectura con línea de tiempo de seguimiento (sin acciones — el docente no puede tomar/cerrar).
- `CoordinacionPage` (`/incidencias-aula/bandeja`): KPIs, filtros por estado/aula, tabla completa, modal de detalle con las tres acciones (tomar, guardar seguimiento, cerrar).
- `DireccionPage` (`/incidencias-aula/resumen`): KPIs del mes, dos gráficos de distribución (reutiliza `recharts`, ya dependencia de `apps/web` desde `moodle-insights` — no se reintroduce Chart.js del prototipo) y tabla de detalle sin columnas identificativas.

`module.manifest.ts`:

```ts
export const incidenciasAulaManifest: ModuleManifest = {
  id: 'incidencias-aula',
  name: 'Registro de Incidencias de Aula',
  description: 'Registro y seguimiento de incidencias de aula de un centro de FP',
  basePath: '/incidencias-aula',
  requiredRoles: ['incidencias_docente', 'incidencias_coordinacion', 'incidencias_direccion', 'admin'],
  nav: [
    { label: 'Registrar incidencia', path: '/incidencias-aula', requiredRoles: ['incidencias_docente', 'admin'], icon: 'FileWarning' },
    { label: 'Bandeja', path: '/incidencias-aula/bandeja', requiredRoles: ['incidencias_coordinacion', 'admin'], icon: 'Inbox' },
    { label: 'Resumen mensual', path: '/incidencias-aula/resumen', requiredRoles: ['incidencias_direccion', 'admin'], icon: 'BarChart3' }
  ]
};
```

Nombres de rol genéricos (`incidencias_docente`/`incidencias_coordinacion`/`incidencias_direccion`) — a confirmar/renombrar en el gate según la respuesta a la pregunta abierta 1 de `spec-funcional.md` (propiedad del centro/cliente); es un cambio de nomenclatura, no de diseño.

## Abierto para el gate técnico (no bloquea el diseño, sí el arranque de generación)

1. Confirmar si `IncidenciaTipo`/`Aula` se mantienen como enum/tabla fija (este diseño) o si el gate pide ya un catálogo editable (spec-funcional.md, preguntas 3-4).
2. Confirmar si coordinación es una sola cuenta o varias compartiendo bandeja sin partición (mismo patrón que `orientador_admin` — se asume "todas comparten" salvo indicación contraria, pregunta abierta 5).
3. Nombrado final de los tres roles según a quién pertenece el módulo (pregunta abierta 1).
4. Si hay alumnado menor de edad confirmado (pregunta abierta 2), verificar con quien encarga si aplica alguna política de acceso adicional del centro más allá de RBAC + auditoría ya prevista.
