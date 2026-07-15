-- Módulo orientador-ia (D-024/D-025, docs/pipeline/orientador-ia/): landing +
-- orientador de carrera en el schema PG "orientador".
-- NOTA: escrita a mano (mismo motivo que core_init/moodle_insights_init: el
-- sandbox de Cowork no puede descargar el schema-engine de Prisma). Al correr
-- `pnpm prisma:migrate` en local, Prisma la aplica y verifica que no haya
-- drift contra schema.prisma; si reportara drift, regenerarla con
-- `prisma migrate dev`.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "orientador";

-- CreateEnum
CREATE TYPE "orientador"."OrientadorInputType" AS ENUM ('story', 'linkedin_url', 'cv_pdf');

-- CreateEnum
CREATE TYPE "orientador"."OrientadorLevel" AS ENUM ('inicial', 'aplicada', 'experto');

-- CreateTable
CREATE TABLE "orientador"."leads" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "consentGiven" BOOLEAN NOT NULL,
    "consentMarketing" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "rawInputType" "orientador"."OrientadorInputType" NOT NULL,
    "rawInputText" TEXT NOT NULL,
    "declaredSector" TEXT,
    "declaredLevel" "orientador"."OrientadorLevel",
    "analysisCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orientador"."profiles" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "recommendedSector" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "estimatedLevel" "orientador"."OrientadorLevel" NOT NULL,
    "skillGaps" JSONB NOT NULL,
    "llmModel" TEXT NOT NULL,
    "llmTokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orientador"."academies" (
    "id" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "synchronous" TEXT NOT NULL,
    "asynchronous" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "modules" JSONB NOT NULL,
    "outcomes" JSONB NOT NULL,
    "priceEur" TEXT NOT NULL,
    "priceUsd" TEXT NOT NULL,
    "purchaseUrl" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orientador"."exports_log" (
    "id" UUID NOT NULL,
    "adminUserId" UUID NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leadCount" INTEGER NOT NULL,

    CONSTRAINT "exports_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "orientador"."leads"("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_leadId_key" ON "orientador"."profiles"("leadId");

-- AddForeignKey
ALTER TABLE "orientador"."profiles" ADD CONSTRAINT "profiles_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "orientador"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
