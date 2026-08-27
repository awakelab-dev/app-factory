-- Row-Level Security (RLS) para panel-prioridades
-- (D-056, docs/05): aislamiento de datos confidencial-personales por usuario.
-- Implementa la barrera de fila en Postgres para preparar multi-usuario futuro
-- sin reingeniería; hoy monouser (solo Antonio), pero la RLS lo previene.

-- Habilitar RLS en todas las tablas del módulo
ALTER TABLE panel.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE panel.schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE panel.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE panel.delegations ENABLE ROW LEVEL SECURITY;

-- Política de tasks: usuario solo ve/edita sus propias tareas
CREATE POLICY tasks_isolation ON panel.tasks
  USING (user_id = CURRENT_SETTING('app.current_user_id')::uuid)
  WITH CHECK (user_id = CURRENT_SETTING('app.current_user_id')::uuid);

-- Política de schedule_blocks: usuario solo ve/edita sus propios bloques
CREATE POLICY schedule_blocks_isolation ON panel.schedule_blocks
  USING (user_id = CURRENT_SETTING('app.current_user_id')::uuid)
  WITH CHECK (user_id = CURRENT_SETTING('app.current_user_id')::uuid);

-- Política de team_members: usuario solo ve/edita su propio equipo
CREATE POLICY team_members_isolation ON panel.team_members
  USING (user_id = CURRENT_SETTING('app.current_user_id')::uuid)
  WITH CHECK (user_id = CURRENT_SETTING('app.current_user_id')::uuid);

-- Política de delegations: usuario solo ve/edita sus propias delegaciones
-- Implícitamente filtrada vía task_id→user_id, pero se redeclara por seguridad
CREATE POLICY delegations_isolation ON panel.delegations
  USING (user_id = CURRENT_SETTING('app.current_user_id')::uuid)
  WITH CHECK (user_id = CURRENT_SETTING('app.current_user_id')::uuid);

-- Grant: allow readers (necesita el rol que use la BD; ver deploy script)
-- Este bloque se ejecutará en el contexto del deployment con permisos apropiados.
-- Por ahora, solo documentar que se requiere:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON panel.tasks TO <role>;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON panel.schedule_blocks TO <role>;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON panel.team_members TO <role>;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON panel.delegations TO <role>;
-- GRANT SELECT ON panel.audit_trail TO admin_role;
