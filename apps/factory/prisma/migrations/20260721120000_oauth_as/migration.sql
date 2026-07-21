-- Fábrica (awkfactory): Fase 1 de docs/08 (D-041) — Authorization Server propio
-- para el conector Cowork (OAuth 2.1 con login usuario/contraseña).
--
-- Solo aditivo: (1) `passwordHash` en factory_actors (argon2id; NULL = actor
-- solo-PAT que no hace login OAuth), (2) tabla `oauth_models` = almacén único
-- del adapter de node-oidc-provider (todos sus tipos de modelo: Session, Grant,
-- AccessToken, RefreshToken, AuthorizationCode, Interaction, etc. en una sola
-- tabla, discriminados por `model`). Sin cambios en projects/specs/gates/runs
-- ni en el guard de PAT/JWT de plataforma (que siguen intactos).
--
-- NOTA: escrita a mano (mismo motivo que las anteriores: el sandbox de Cowork
-- no puede descargar el schema-engine de Prisma). Al correr `pnpm prisma:migrate`
-- contra una BD limpia, Prisma la aplica y verifica que no haya drift.

-- AlterTable: credencial de login del AS (argon2id). Nullable: los técnicos
-- solo-PAT no la necesitan (no hacen login OAuth).
ALTER TABLE "factory_actors" ADD COLUMN "passwordHash" TEXT;

-- CreateTable: almacén del adapter de node-oidc-provider. Genérico y a prueba
-- de futuro (el payload es un JSONB opaco cuya forma la define la librería,
-- no nosotros). PK compuesta (model, id): cada tipo de modelo tiene su propio
-- espacio de ids. Columnas auxiliares desnormalizadas para los find-by:
--   - grantId  → revokeByGrantId (borra todos los tokens de un grant)
--   - userCode → findByUserCode (device flow; no lo usamos, pero el contrato lo pide)
--   - uid      → findByUid (Session)
--   - consumedAt → consume() marca sin borrar (single-use de auth codes/refresh)
--   - expiresAt  → barrido de expirados
CREATE TABLE "oauth_models" (
    "model" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "grantId" TEXT,
    "userCode" TEXT,
    "uid" TEXT,
    "expiresAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_models_pkey" PRIMARY KEY ("model","id")
);

-- CreateIndex
CREATE INDEX "oauth_models_grantId_idx" ON "oauth_models"("grantId");
CREATE INDEX "oauth_models_userCode_idx" ON "oauth_models"("userCode");
CREATE INDEX "oauth_models_uid_idx" ON "oauth_models"("uid");
CREATE INDEX "oauth_models_expiresAt_idx" ON "oauth_models"("expiresAt");
