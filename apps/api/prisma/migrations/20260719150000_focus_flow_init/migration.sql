-- Módulo focus-flow (docs/pipeline/focus-flow/): temporizador Pomodoro
-- personal con cola de tareas del día y estadísticas reales, en el schema
-- PG "focus". Aislamiento por fila estricto (dueño = userId del JWT, sin
-- excepciones): "userId"/"sourceProyectosTaskId" son referencias
-- conceptuales (sin FK cross-schema), mismo patrón que proyectos/moodle.
-- NOTA: escrita a mano (mismo motivo que core_init/moodle_insights_init/
-- orientador_ia_init/gestor_proyectos_init: sin schema-engine de Prisma en
-- el sandbox). Al correr `pnpm prisma:migrate` en local, Prisma la aplica y
-- verifica que no haya drift contra schema.prisma; si reportara drift,
-- regenerarla con `prisma migrate dev`.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "focus";

-- CreateEnum
CREATE TYPE "focus"."FocusSessionPhase" AS ENUM ('focus', 'short_break', 'long_break');

-- CreateTable
CREATE TABLE "focus"."settings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "focusMinutes" INTEGER NOT NULL DEFAULT 25,
    "shortBreakMinutes" INTEGER NOT NULL DEFAULT 5,
    "longBreakMinutes" INTEGER NOT NULL DEFAULT 15,
    "roundsBeforeLongBreak" INTEGER NOT NULL DEFAULT 4,
    "autoStartBreaks" BOOLEAN NOT NULL DEFAULT true,
    "autoStartFocus" BOOLEAN NOT NULL DEFAULT false,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "focus"."tasks" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "estimatedPomodoros" INTEGER NOT NULL DEFAULT 1,
    "completedPomodoros" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "taskDate" DATE NOT NULL,
    "sourceProyectosTaskId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "focus"."sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "taskId" UUID,
    "phase" "focus"."FocusSessionPhase" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "wasSkipped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "settings_userId_key" ON "focus"."settings"("userId");

-- CreateIndex
CREATE INDEX "tasks_userId_taskDate_idx" ON "focus"."tasks"("userId", "taskDate");

-- CreateIndex
CREATE INDEX "sessions_userId_completedAt_idx" ON "focus"."sessions"("userId", "completedAt");

-- AddForeignKey (SetNull: borrar una tarea no debe perder el historial de
-- pomodoros ya contabilizado — ver schema.prisma, FocusSession)
ALTER TABLE "focus"."sessions" ADD CONSTRAINT "sessions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "focus"."tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
