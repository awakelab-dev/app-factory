-- Módulo moodle-insights (primer módulo ejemplar, D-020/D-022): réplica
-- parcial y de solo lectura de una instancia Moodle en el schema PG "moodle".
-- NOTA: escrita a mano (mismo motivo que core_init: el sandbox de Cowork no
-- puede descargar el schema-engine de Prisma). Al correr `pnpm prisma:migrate`
-- en local, Prisma la aplica y verifica que no haya drift contra schema.prisma;
-- si reportara drift, regenerarla con `prisma migrate dev`.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "moodle";

-- CreateEnum
CREATE TYPE "moodle"."MoodleSyncStatus" AS ENUM ('running', 'success', 'error');

-- CreateTable
CREATE TABLE "moodle"."sync_runs" (
    "id" UUID NOT NULL,
    "status" "moodle"."MoodleSyncStatus" NOT NULL DEFAULT 'running',
    "triggeredById" UUID,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "coursesCount" INTEGER NOT NULL DEFAULT 0,
    "studentsCount" INTEGER NOT NULL DEFAULT 0,
    "enrollmentsCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moodle"."courses" (
    "id" UUID NOT NULL,
    "moodleId" INTEGER NOT NULL,
    "shortname" TEXT NOT NULL,
    "fullname" TEXT NOT NULL,
    "categoryId" INTEGER,
    "categoryName" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moodle"."students" (
    "id" UUID NOT NULL,
    "moodleId" INTEGER NOT NULL,
    "fullname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moodle"."enrollments" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moodle"."grades" (
    "id" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "grade" DOUBLE PRECISION,
    "gradeMax" DOUBLE PRECISION,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_runs_startedAt_idx" ON "moodle"."sync_runs"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "courses_moodleId_key" ON "moodle"."courses"("moodleId");

-- CreateIndex
CREATE UNIQUE INDEX "students_moodleId_key" ON "moodle"."students"("moodleId");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_courseId_studentId_key" ON "moodle"."enrollments"("courseId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "grades_courseId_studentId_key" ON "moodle"."grades"("courseId", "studentId");

-- AddForeignKey
ALTER TABLE "moodle"."enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "moodle"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moodle"."enrollments" ADD CONSTRAINT "enrollments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "moodle"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moodle"."grades" ADD CONSTRAINT "grades_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "moodle"."courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moodle"."grades" ADD CONSTRAINT "grades_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "moodle"."students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
