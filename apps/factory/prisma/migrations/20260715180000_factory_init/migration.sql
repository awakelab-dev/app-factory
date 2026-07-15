-- Fábrica (awkfactory): modelo de datos del pipeline (docs/03/docs/04, D-029).
-- Base de datos SEPARADA de la Plataforma (awkplatform_staging/production):
-- misma instancia Postgres managed, nueva base lógica "awkfactory_*" (D-029),
-- sin schemas adicionales (todo en "public", a diferencia de apps/api que
-- usa multiSchema core/moodle/orientador dentro de una única base).
-- NOTA: escrita a mano (mismo motivo que core_init/moodle/orientador: el
-- sandbox de Cowork no puede descargar el schema-engine de Prisma). Al correr
-- `pnpm prisma:migrate` en local contra una BD "awkfactory" limpia, Prisma la
-- aplica y verifica que no haya drift contra schema.prisma; si reportara
-- drift, regenerarla con `prisma migrate dev`.

-- CreateEnum
CREATE TYPE "project_status" AS ENUM ('received', 'analyzing', 'spec_ready', 'pending_approval', 'generating', 'verifying', 'pr_review', 'staging', 'manager_acceptance', 'deployed', 'changes_requested', 'rejected', 'error');

-- CreateEnum
CREATE TYPE "project_source_type" AS ENUM ('manual', 'cowork_prototype');

-- CreateEnum
CREATE TYPE "gate_type" AS ENUM ('functional', 'technical', 'pr_review', 'manager_acceptance');

-- CreateEnum
CREATE TYPE "gate_status" AS ENUM ('pending', 'approved', 'rejected', 'changes_requested');

-- CreateEnum
CREATE TYPE "run_type" AS ENUM ('analysis', 'generation');

-- CreateEnum
CREATE TYPE "run_status" AS ENUM ('pending', 'running', 'success', 'error');

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "moduleSlug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sourceType" "project_source_type" NOT NULL DEFAULT 'manual',
    "sourceRef" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "project_status" NOT NULL DEFAULT 'received',

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specs" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "functionalContent" TEXT NOT NULL,
    "technicalContent" TEXT NOT NULL,
    "complexityScore" INTEGER,
    "sensitivityFlags" JSONB NOT NULL DEFAULT '[]',
    "reuseNotes" TEXT,

    CONSTRAINT "specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gates" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "specId" UUID NOT NULL,
    "gateType" "gate_type" NOT NULL,
    "status" "gate_status" NOT NULL DEFAULT 'pending',
    "reviewer" TEXT,
    "decisionNotes" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "projectId" UUID NOT NULL,
    "specId" UUID,
    "runType" "run_type" NOT NULL,
    "status" "run_status" NOT NULL DEFAULT 'pending',
    "branchName" TEXT,
    "prUrl" TEXT,
    "agentSessionId" TEXT,
    "outputSummary" TEXT,
    "errorMessage" TEXT,
    "costUsd" DOUBLE PRECISION,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_moduleSlug_key" ON "projects"("moduleSlug");

-- CreateIndex
CREATE UNIQUE INDEX "specs_projectId_version_key" ON "specs"("projectId", "version");

-- AddForeignKey
ALTER TABLE "specs" ADD CONSTRAINT "specs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gates" ADD CONSTRAINT "gates_specId_fkey" FOREIGN KEY ("specId") REFERENCES "specs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_specId_fkey" FOREIGN KEY ("specId") REFERENCES "specs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
