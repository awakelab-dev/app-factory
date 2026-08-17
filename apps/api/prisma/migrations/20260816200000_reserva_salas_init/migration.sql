-- Plataforma (awkplatform): módulo `reserva-salas` (D-048) — primer módulo cuyo
-- análisis disparó la propia Fábrica al recibir el prototipo desde Cowork.
-- Migración de integración: la escribe un humano, no la generación (que solo
-- toca schema.prisma y las carpetas del módulo).
--
-- Schema PG propio `reservas`, siguiendo la convención del repo (nombre corto
-- que no repite el slug: `orientador`, `proyectos`, `focus`, `incidencias`).

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "reservas";

-- CreateTable
CREATE TABLE "reservas"."salas" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "equipamiento" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas"."reservas" (
    "id" UUID NOT NULL,
    "salaId" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "hora" VARCHAR(5) NOT NULL,
    "userId" UUID NOT NULL,
    "personaNombre" TEXT NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceladaAt" TIMESTAMP(3),

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salas_nombre_key" ON "reservas"."salas"("nombre");

-- CreateIndex
CREATE INDEX "reservas_salaId_fecha_hora_idx" ON "reservas"."reservas"("salaId", "fecha", "hora");

-- CreateIndex
CREATE INDEX "reservas_userId_idx" ON "reservas"."reservas"("userId");

-- CreateIndex: LA GARANTÍA DE "NUNCA DOS RESERVAS EN LA MISMA FRANJA".
-- La spec técnica aprobada la pedía —`unique(sala_id, fecha, hora) where
-- cancelada_at IS NULL`— y la generación no la puso: dejó un índice normal,
-- porque Prisma NO SABE declarar índices únicos parciales. Sin esto, la única
-- defensa es el `findFirst` que el servicio hace antes de insertar, y entre
-- ese SELECT y el INSERT cabe otra petición: dos personas reservando la misma
-- sala a la vez se cuelan las dos. Justo el problema que el módulo existe para
-- resolver.
--
-- Vive solo en SQL a propósito. `prisma migrate dev` lo reportará como drift
-- (no puede representarlo en el schema); es un coste asumido y conocido, igual
-- que en `analysis_jobs` de la Fábrica. El `findFirst` del servicio se queda:
-- da el 409 amable; esto es la red de seguridad de la base.
CREATE UNIQUE INDEX "reservas_franja_activa_key"
    ON "reservas"."reservas"("salaId", "fecha", "hora")
    WHERE "canceladaAt" IS NULL;

-- AddForeignKey
ALTER TABLE "reservas"."reservas" ADD CONSTRAINT "reservas_salaId_fkey" FOREIGN KEY ("salaId") REFERENCES "reservas"."salas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
