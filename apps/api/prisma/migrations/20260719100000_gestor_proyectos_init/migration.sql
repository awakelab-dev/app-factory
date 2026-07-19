-- Módulo gestor-proyectos (docs/pipeline/gestor-proyectos/): kanban interno de
-- proyectos/sprints/tareas en el schema PG "proyectos".
-- NOTA: escrita a mano (mismo motivo que core_init/moodle_insights_init/
-- orientador_ia_init: sin schema-engine de Prisma en el sandbox). Al correr
-- `pnpm prisma:migrate` en local, Prisma la aplica y verifica que no haya
-- drift contra schema.prisma; si reportara drift, regenerarla con
-- `prisma migrate dev`.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "proyectos";

-- CreateEnum
CREATE TYPE "proyectos"."ProyectosTaskStatus" AS ENUM ('iniciada', 'en_progreso', 'en_pausa', 'cancelada', 'finalizada');

-- CreateTable
CREATE TABLE "proyectos"."projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyectos"."sprints" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyectos"."tasks" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sprintId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "proyectos"."ProyectosTaskStatus" NOT NULL DEFAULT 'iniciada',
    "dueDate" DATE NOT NULL,
    "assigneeId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyectos"."subtasks" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyectos"."comments" (
    "id" UUID NOT NULL,
    "taskId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sprints_projectId_idx" ON "proyectos"."sprints"("projectId");

-- CreateIndex
CREATE INDEX "tasks_projectId_idx" ON "proyectos"."tasks"("projectId");

-- CreateIndex
CREATE INDEX "tasks_sprintId_idx" ON "proyectos"."tasks"("sprintId");

-- CreateIndex
CREATE INDEX "tasks_assigneeId_idx" ON "proyectos"."tasks"("assigneeId");

-- CreateIndex
CREATE INDEX "subtasks_taskId_idx" ON "proyectos"."subtasks"("taskId");

-- CreateIndex
CREATE INDEX "comments_taskId_idx" ON "proyectos"."comments"("taskId");

-- AddForeignKey
ALTER TABLE "proyectos"."sprints" ADD CONSTRAINT "sprints_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "proyectos"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos"."tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "proyectos"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos"."tasks" ADD CONSTRAINT "tasks_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "proyectos"."sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos"."subtasks" ADD CONSTRAINT "subtasks_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "proyectos"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyectos"."comments" ADD CONSTRAINT "comments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "proyectos"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
