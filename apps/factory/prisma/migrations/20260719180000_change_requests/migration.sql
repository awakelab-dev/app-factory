-- Fábrica (awkfactory): request_change (docs/04-integracion-cowork.md).
-- Añade la entidad ligera `change_requests` (una petición de cambio sobre un
-- módulo ya vivo) y el enlace opcional `specs.changeRequestId` (una spec que
-- es mini-spec de un cambio en vez de la spec de intake original).
-- Modelo LIGERO (decisión 2026-07-19): sin máquina de estados propia; el
-- pipeline se reutiliza sobre el mismo Project. No hay enum nuevo — el análisis
-- de cambio reutiliza run_type 'analysis' y la generación 'generation'.
-- NOTA: escrita a mano (mismo motivo que factory_init: el sandbox de Cowork no
-- puede descargar el schema-engine de Prisma). Al correr `pnpm prisma:migrate`
-- en local contra una BD limpia, Prisma la aplica y verifica que no haya drift.

-- CreateTable
CREATE TABLE "change_requests" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" UUID NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "requestText" TEXT NOT NULL,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "specs" ADD COLUMN "changeRequestId" UUID;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specs" ADD CONSTRAINT "specs_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
