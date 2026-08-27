-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "panel";

-- CreateTable
CREATE TABLE "panel"."tasks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "detail" TEXT,
    "urgent" BOOLEAN NOT NULL,
    "important" BOOLEAN NOT NULL,
    "quadrant" SMALLINT NOT NULL,
    "action" TEXT NOT NULL,
    "dueDate" DATE,
    "estimatedMinutes" SMALLINT NOT NULL,
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel"."schedule_blocks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskId" UUID,
    "dayOfWeek" SMALLINT NOT NULL,
    "hour" SMALLINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel"."team_members" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "addedByUserId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel"."delegations" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "delegatedToName" VARCHAR(100),
    "followUpDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delegations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel"."audit_trail" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "taskId" UUID,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_trail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_userId_status_idx" ON "panel"."tasks"("userId", "status");

-- CreateIndex
CREATE INDEX "tasks_userId_quadrant_idx" ON "panel"."tasks"("userId", "quadrant");

-- CreateIndex
CREATE INDEX "tasks_dueDate_idx" ON "panel"."tasks"("dueDate");

-- CreateIndex
CREATE INDEX "schedule_blocks_userId_dayOfWeek_idx" ON "panel"."schedule_blocks"("userId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_blocks_userId_dayOfWeek_hour_key" ON "panel"."schedule_blocks"("userId", "dayOfWeek", "hour");

-- CreateIndex
CREATE INDEX "team_members_userId_active_idx" ON "panel"."team_members"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "delegations_taskId_key" ON "panel"."delegations"("taskId");

-- CreateIndex
CREATE INDEX "delegations_userId_idx" ON "panel"."delegations"("userId");

-- CreateIndex
CREATE INDEX "delegations_followUpDate_idx" ON "panel"."delegations"("followUpDate");

-- CreateIndex
CREATE INDEX "audit_trail_userId_idx" ON "panel"."audit_trail"("userId");

-- CreateIndex
CREATE INDEX "audit_trail_taskId_idx" ON "panel"."audit_trail"("taskId");

-- CreateIndex
CREATE INDEX "audit_trail_createdAt_idx" ON "panel"."audit_trail"("createdAt");

-- AddForeignKey
ALTER TABLE "panel"."schedule_blocks" ADD CONSTRAINT "schedule_blocks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "panel"."tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel"."delegations" ADD CONSTRAINT "delegations_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "panel"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel"."audit_trail" ADD CONSTRAINT "audit_trail_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "panel"."tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Añadido automáticamente desde apps/api/src/modules/panel-prioridades/migration.extra.sql
-- (constraints que Prisma no sabe declarar: índice único parcial, CHECK, exclusion).
-- No editar aquí: se reescribe en cada generación. Ver D-049 y docs/09-incremento-d-cero-consola.md.
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
