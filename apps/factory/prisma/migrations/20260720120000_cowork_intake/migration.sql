-- Fábrica (awkfactory): incremento A de Fase 2 (D-036) — integración Cowork.
-- Solo aditivo sobre D-029/D-034: tabla `factory_actors` (auth interina PAT
-- por gerente, sin FK a core.users) y `prototype_submissions` (fuente HTML +
-- prototype.manifest.json de submit_prototype; el CLI analyze la materializa
-- a disco). Sin cambios en projects/specs/gates/runs ni en la máquina de
-- estados (project_source_type ya tenía 'cowork_prototype' desde factory_init).
-- NOTA: escrita a mano (mismo motivo que factory_init/change_requests: el
-- sandbox de Cowork no puede descargar el schema-engine de Prisma). Al correr
-- `pnpm prisma:migrate` en local contra una BD limpia, Prisma la aplica y
-- verifica que no haya drift.

-- CreateEnum
CREATE TYPE "factory_actor_role" AS ENUM ('gerente', 'admin');

-- CreateTable
CREATE TABLE "factory_actors" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "role" "factory_actor_role" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "factory_actors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prototype_submissions" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" UUID NOT NULL,
    "manifest" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,

    CONSTRAINT "prototype_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "factory_actors_tokenHash_key" ON "factory_actors"("tokenHash");

-- CreateIndex
CREATE INDEX "factory_actors_email_idx" ON "factory_actors"("email");

-- CreateIndex
CREATE INDEX "prototype_submissions_projectId_idx" ON "prototype_submissions"("projectId");

-- AddForeignKey
ALTER TABLE "prototype_submissions" ADD CONSTRAINT "prototype_submissions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
