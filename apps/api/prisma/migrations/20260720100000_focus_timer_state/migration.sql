-- Módulo focus-flow · change-2 (docs/pipeline/focus-flow/change-2/): persistencia
-- del ciclo activo del temporizador. Añade "focus"."timer_state" (fila única por
-- usuario, mismo aislamiento estricto por "userId" que el resto del schema focus,
-- sin FK cross-schema). Aditiva: no toca settings/tasks/sessions ni el enum.
-- NOTA: escrita a mano (mismo motivo que focus_flow_init: sin schema-engine de
-- Prisma en el sandbox). `pnpm prisma:migrate` en local la aplica y verifica drift.

-- CreateTable
CREATE TABLE "focus"."timer_state" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "phase" "focus"."FocusSessionPhase" NOT NULL DEFAULT 'focus',
    "round" INTEGER NOT NULL DEFAULT 1,
    "taskId" UUID,
    "phaseStartedAt" TIMESTAMP(3),
    "accumulatedSeconds" INTEGER NOT NULL DEFAULT 0,
    "running" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timer_state_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "timer_state_userId_key" ON "focus"."timer_state"("userId");
