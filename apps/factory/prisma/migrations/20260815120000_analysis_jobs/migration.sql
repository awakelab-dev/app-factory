-- Fábrica (awkfactory): incremento C de Fase 2 (D-047) — análisis server-side
-- automático. Solo aditivo: tabla `analysis_jobs` (cola de trabajos de
-- análisis) y sus dos enums. Nada de projects/specs/gates/runs cambia, ni la
-- máquina de estados: un trabajo encolado deja el proyecto en `received` (o en
-- su estado asentado, si es un cambio) hasta que el worker lo toma y hace la
-- transición a `analyzing` como siempre.
--
-- Por qué una tabla y no reutilizar `runs`: `Run` es el registro de auditoría
-- de UNA ejecución del Agent SDK (coste, tokens, sesión). Un trabajo puede
-- morir antes de ejecutar nada; mezclar cola y auditoría es lo que produjo los
-- runs huérfanos de D-030/D-046.
--
-- La unicidad "un trabajo activo por proyecto" NO se declara como índice
-- parcial a propósito: Prisma no sabe expresarlos y el schema quedaría con
-- drift permanente. Se garantiza en AnalysisJobsService.enqueue con
-- `SELECT ... FROM projects WHERE id = $1 FOR UPDATE` dentro de la misma
-- transacción que inserta el trabajo.
--
-- NOTA: escrita a mano (mismo motivo que las anteriores: el sandbox de Cowork
-- no puede descargar el schema-engine de Prisma). Al correr `pnpm prisma:migrate`
-- contra una BD limpia, Prisma la aplica y verifica que no haya drift.

-- CreateEnum
CREATE TYPE "analysis_job_kind" AS ENUM ('analysis', 'change_analysis');

-- CreateEnum
CREATE TYPE "analysis_job_status" AS ENUM ('queued', 'running', 'success', 'error');

-- CreateTable
CREATE TABLE "analysis_jobs" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "kind" "analysis_job_kind" NOT NULL,
    "projectId" UUID NOT NULL,
    "changeRequestId" UUID,
    "status" "analysis_job_status" NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requestedBy" TEXT NOT NULL,
    "workerId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "runId" UUID,
    "errorMessage" TEXT,

    CONSTRAINT "analysis_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: el orden exacto del `claim` (status + createdAt asc).
CREATE INDEX "analysis_jobs_status_createdAt_idx" ON "analysis_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "analysis_jobs_projectId_idx" ON "analysis_jobs"("projectId");

-- AddForeignKey
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
