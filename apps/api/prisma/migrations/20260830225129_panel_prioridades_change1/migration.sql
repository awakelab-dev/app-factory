-- Añadido automáticamente desde apps/api/src/modules/panel-prioridades/migration.extra.sql
-- (constraints que Prisma no sabe declarar: índice único parcial, CHECK, exclusion).
-- No editar aquí: se reescribe en cada generación. Ver D-049 y docs/09-incremento-d-cero-consola.md.
-- Row-Level Security (RLS) para panel-prioridades
-- (D-056, docs/05): aislamiento de datos confidencial-personales por usuario.
-- Implementa la barrera de fila en Postgres para preparar multi-usuario futuro
-- sin reingeniería; hoy monouser (solo Antonio), pero la RLS lo previene.
--
-- NOTA IMPORTANTE (enmienda 2026-08-27): Los identificadores de COLUMNAS en
-- comillas dobles usan camelCase ("userId", "taskId", etc.) por la convención
-- del repo (@@map a nivel tabla, campos sin @map → camelCase en BD).
-- Ver docs/02-stack.md y la enmienda técnica post-CI en la PR #12.

-- Habilitar RLS en todas las tablas del módulo
ALTER TABLE panel.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE panel.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE panel.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE panel.delegations ENABLE ROW LEVEL SECURITY;

-- Política de tasks: usuario solo ve/edita sus propias tareas
-- Filtra por "userId" (camelCase, columna real en Postgres tras la migración Prisma).
CREATE POLICY tasks_isolation ON panel.tasks
  USING ("userId" = CURRENT_SETTING('app.current_user_id')::uuid)
  WITH CHECK ("userId" = CURRENT_SETTING('app.current_user_id')::uuid);

-- Política de schedule_blocks: usuario solo ve/edita sus propios bloques
-- Filtra por "userId".
CREATE POLICY schedule_blocks_isolation ON panel.schedule_blocks
  USING ("userId" = CURRENT_SETTING('app.current_user_id')::uuid)
  WITH CHECK ("userId" = CURRENT_SETTING('app.current_user_id')::uuid);

-- Política de team_members: usuario solo ve/edita su propio equipo
-- Filtra por "userId".
CREATE POLICY team_members_isolation ON panel.team_members
  USING ("userId" = CURRENT_SETTING('app.current_user_id')::uuid)
  WITH CHECK ("userId" = CURRENT_SETTING('app.current_user_id')::uuid);

-- Política de delegations: usuario solo ve/edita sus propias delegaciones
-- Filtra por "userId". Implícitamente filtrada vía "taskId"→"userId",
-- pero se redeclara por seguridad (defensa en profundidad).
CREATE POLICY delegations_isolation ON panel.delegations
  USING ("userId" = CURRENT_SETTING('app.current_user_id')::uuid)
  WITH CHECK ("userId" = CURRENT_SETTING('app.current_user_id')::uuid);

-- Índice único PARCIAL en schedule_blocks (una sola tarea por franja, activos)
-- Prisma no soporta índices parciales: esta constraint se añade aquí.
-- Regla de negocio: el usuario no puede reservar dos tareas en el mismo
-- bloque (día, hora). La columna "taskId" puede ser NULL si la tarea se borra,
-- y el índice no debe bloquear reservar de nuevo el mismo hueco.
-- De ahí el WHERE: solo se aplica cuando "taskId" IS NOT NULL (índice parcial).
CREATE UNIQUE INDEX CONCURRENTLY panel_schedule_blocks_unique_slot
  ON panel.schedule_blocks ("userId", "dayOfWeek", "hour")
  WHERE "taskId" IS NOT NULL;

-- Grant: allow readers (necesita el rol que use la BD; ver deploy script)
-- Este bloque se ejecutará en el contexto del deployment con permisos apropiados.
-- Por ahora, solo documentar que se requiere:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON panel.tasks TO <role>;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON panel.schedule_blocks TO <role>;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON panel.team_members TO <role>;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON panel.delegations TO <role>;
-- GRANT SELECT ON panel.audit_trail TO admin_role;
