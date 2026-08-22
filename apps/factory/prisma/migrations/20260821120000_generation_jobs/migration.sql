-- Fábrica (awkfactory): incremento D fase D3 (docs/09) — generación
-- server-side con reintento y merge verificado. SOLO ADITIVO: dos valores
-- nuevos en el enum de kinds y dos columnas nullable en `analysis_jobs`.
-- Ninguna fila existente cambia de significado y ningún kind actual
-- (`analysis`, `change_analysis`) se toca.
--
-- La tabla se sigue llamando `analysis_jobs` aunque ya no sea solo de
-- análisis: renombrarla exigiría una migración destructiva (drop + recreate de
-- la FK y del enum) a cambio de nada funcional. Deuda cosmética, anotada aquí
-- y no pagada (docs/09, "Disparo").
--
-- NOTA: escrita a mano, como las cinco anteriores de esta base — `prisma
-- migrate diff` necesita descargar el schema-engine y el sandbox de Cowork
-- recibe 403 de binaries.prisma.sh (D-051). Verificada aplicando la CADENA
-- COMPLETA de migraciones sobre un PostgreSQL real y comparando el resultado
-- contra lo que declara schema.prisma.

-- AlterEnum: `ALTER TYPE ... ADD VALUE` no puede correr dentro de un bloque
-- transaccional en Postgres < 12; en 12+ sí, y la managed PG es 16. Prisma
-- envuelve cada migración en una transacción, así que esto DEPENDE de esa
-- versión — si algún día la base baja de 12, hay que partir el archivo.
ALTER TYPE "analysis_job_kind" ADD VALUE IF NOT EXISTS 'generation';
ALTER TYPE "analysis_job_kind" ADD VALUE IF NOT EXISTS 'pr_merge';

-- AlterTable: la spec que se genera (kind generation/pr_merge) y la hora a
-- partir de la cual un trabajo reintentable vuelve a ser tomable (backoff).
ALTER TABLE "analysis_jobs" ADD COLUMN "specId" UUID;
ALTER TABLE "analysis_jobs" ADD COLUMN "nextAttemptAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "analysis_jobs_specId_idx" ON "analysis_jobs"("specId");

-- AddForeignKey: ON DELETE CASCADE igual que projectId/changeRequestId — si se
-- borra la spec, su trabajo de generación deja de tener sentido.
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_specId_fkey" FOREIGN KEY ("specId") REFERENCES "specs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
