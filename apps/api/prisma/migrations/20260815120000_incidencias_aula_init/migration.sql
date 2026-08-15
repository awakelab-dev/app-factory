-- Módulo incidencias-aula (docs/pipeline/incidencias-aula/): registro y
-- seguimiento de incidencias de aula/convivencia de un centro de FP, en el
-- schema PG "incidencias". Datos personales de alumnado potencialmente menor
-- de edad (gate funcional 2026-08-15, decisión 2): sin RLS — mismo criterio
-- que orientador-ia —, control por RBAC de endpoint + permisos por fila +
-- auditoría de accesos al detalle. "docenteId"/"cerradaPorId"/"autorId" son
-- referencias conceptuales a core.users.id SIN FK cross-schema, mismo patrón
-- que proyectos/focus.
-- NOTA: escrita a mano (mismo motivo que core_init/moodle_insights_init/
-- orientador_ia_init/gestor_proyectos_init/focus_flow_init: sin schema-engine
-- de Prisma en el entorno de generación). Al correr `pnpm prisma:migrate` en
-- local, Prisma la aplica y verifica que no haya drift contra schema.prisma;
-- si reportara drift, regenerarla con `prisma migrate dev`.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "incidencias";

-- CreateEnum
CREATE TYPE "incidencias"."IncidenciaTipo" AS ENUM ('convivencia', 'retraso_reiterado', 'material_danado', 'ausencia_injustificada', 'uso_indebido_dispositivos', 'otro');

-- CreateEnum
CREATE TYPE "incidencias"."IncidenciaGravedad" AS ENUM ('baja', 'media', 'alta');

-- CreateEnum
CREATE TYPE "incidencias"."EstadoIncidencia" AS ENUM ('abierta', 'en_curso', 'cerrada');

-- CreateTable
CREATE TABLE "incidencias"."aulas" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidencias"."incidencias" (
    "id" UUID NOT NULL,
    "alumnoNombre" TEXT NOT NULL,
    "aulaId" UUID NOT NULL,
    "tipo" "incidencias"."IncidenciaTipo" NOT NULL,
    "gravedad" "incidencias"."IncidenciaGravedad" NOT NULL,
    "fechaHecho" DATE NOT NULL,
    "relato" TEXT NOT NULL,
    "docenteId" UUID NOT NULL,
    "estado" "incidencias"."EstadoIncidencia" NOT NULL DEFAULT 'abierta',
    "resolucion" TEXT,
    "cerradaAt" TIMESTAMP(3),
    "cerradaPorId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidencias"."incidencia_seguimientos" (
    "id" UUID NOT NULL,
    "incidenciaId" UUID NOT NULL,
    "autorId" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidencia_seguimientos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aulas_nombre_key" ON "incidencias"."aulas"("nombre");

-- CreateIndex
CREATE INDEX "incidencias_docenteId_idx" ON "incidencias"."incidencias"("docenteId");

-- CreateIndex
CREATE INDEX "incidencias_estado_idx" ON "incidencias"."incidencias"("estado");

-- CreateIndex
CREATE INDEX "incidencias_aulaId_idx" ON "incidencias"."incidencias"("aulaId");

-- CreateIndex
CREATE INDEX "incidencia_seguimientos_incidenciaId_idx" ON "incidencias"."incidencia_seguimientos"("incidenciaId");

-- AddForeignKey
ALTER TABLE "incidencias"."incidencias" ADD CONSTRAINT "incidencias_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "incidencias"."aulas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidencias"."incidencia_seguimientos" ADD CONSTRAINT "incidencia_seguimientos_incidenciaId_fkey" FOREIGN KEY ("incidenciaId") REFERENCES "incidencias"."incidencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;
