# Módulo Panel de Prioridades (D-056)

Panel personal de gestión de tareas usando la matriz de Eisenhower (urgencia × importancia).

## Estructura

```
panel-prioridades/
├── panel-prioridades.module.ts          # Módulo NestJS
├── panel-prioridades.controller.ts      # Endpoints HTTP
├── panel-prioridades-tasks.service.ts   # Gestión de tareas
├── panel-prioridades-schedule.service.ts # Bloques de tiempo
├── panel-prioridades-team.service.ts    # Gestión del equipo
├── panel-prioridades-delegations.service.ts # Delegaciones
├── panel-prioridades-kpis.service.ts    # KPIs e indicadores
├── panel-prioridades.mappers.ts         # DTO mappers
├── panel-prioridades.types.ts           # Zod schemas
├── migration.extra.sql                  # RLS policies + índices
├── *.spec.ts                            # Tests Vitest
└── README.md                            # Este archivo
```

## Rol nuevo

- `panel_admin`: acceso al panel de prioridades (monouser en MVP, preparado para multi-usuario).

## Datos y seguridad

- **Clasificación**: confidencial-personal (tareas confidenciales + nombres del equipo).
- **RLS (Row-Level Security)**: activo en Postgres en todas las tablas (`panel.*`).
- **RBAC**: @Roles('panel_admin', 'admin') en todos los endpoints.
- **Auditoría**: integrada con AuditService del core (D-020).

## Endpoints

Todos los endpoints filtr por `userId` del JWT (redundante con RLS, pero explícito en lógica de negocio).

### Tareas
- GET `/api/panel-prioridades/tasks` — listar (filtros opcionales: quadrant, status, origin)
- POST `/api/panel-prioridades/tasks` — crear
- PUT `/api/panel-prioridades/tasks/:id` — actualizar
- DELETE `/api/panel-prioridades/tasks/:id` — cerrar (done/discarded)
- GET `/api/panel-prioridades/tasks/:id/history` — historial de cambios

### Agenda (bloques de tiempo)
- GET `/api/panel-prioridades/schedule` — semana completa (lunes–viernes, 8–17)
- POST `/api/panel-prioridades/schedule/:taskId/:day/:hour` — reservar bloque
- DELETE `/api/panel-prioridades/schedule/:day/:hour` — liberar bloque

### Equipo
- GET `/api/panel-prioridades/team` — listar miembros
- POST `/api/panel-prioridades/team` — añadir miembro
- PUT `/api/panel-prioridades/team/:id` — editar miembro
- DELETE `/api/panel-prioridades/team/:id` — desactivar miembro (soft delete)

### Delegaciones
- GET `/api/panel-prioridades/delegations` — listar delegaciones
- PUT `/api/panel-prioridades/tasks/:id/delegate` — establecer/cambiar delegación

### KPIs
- GET `/api/panel-prioridades/kpis` — indicadores + diagnósticos automáticos

## Validaciones de negocio

1. **Cuadrante**: computado automáticamente a partir de `urgent` e `important`.
   - Q1: urgent + important → acción "do"
   - Q2: not-urgent + important → acción "plan"
   - Q3: urgent + not-important → acción "delegate"
   - Q4: not-urgent + not-important → acción "eliminate"

2. **Bloques de tiempo**: solo Q1 y Q2 pueden ser agendados. Q3 y Q4 rechazan con 400.

3. **Delegación**: solo Q3. No requiere responsable (es un aviso, no un bloqueo).

4. **Cierre de tarea**: libera automáticamente todos sus bloques agendados.

5. **Movimiento entre cuadrantes**:
   - Si sale de Q3: limpia delegación.
   - Si entra a Q4: elimina bloques agendados.

6. **Fechas vencidas**: generan avisos visuales (`overdue: boolean`), no cambios automáticos de estado.

## RLS y Postgres

Las tablas `panel.tasks`, `panel.schedule_blocks`, `panel.team_members`, `panel.delegations`
tienen RLS habilitado con políticas que filtran por `"userId" = CURRENT_SETTING('app.current_user_id')::uuid`.

El `migration.extra.sql` declara:
- Las 4 políticas USING + WITH CHECK.
- Un índice único PARCIAL en `schedule_blocks` (Prisma no lo soporta, así que va en migration.extra.sql).

**Nota importante**: Los identificadores de columna en SQL crudas van en comillas dobles con camelCase
(`"userId"`, `"taskId"`, etc.) por la convención del repo (@@map a nivel tabla, campos sin @map).

## Testing

```bash
pnpm exec turbo run test --filter=@awk/api
```

Tests con Vitest: `*.spec.ts`. Mocking de Prisma con `vi.mock('../../core/prisma/prisma.service')`.
