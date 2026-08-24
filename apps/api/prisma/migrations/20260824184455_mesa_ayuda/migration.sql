-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "mesa_ayuda";

-- CreateEnum
CREATE TYPE "mesa_ayuda"."TicketStatus" AS ENUM ('abierto', 'en_proceso', 'resuelto', 'cerrado', 'reabierto');

-- CreateEnum
CREATE TYPE "mesa_ayuda"."TicketPriority" AS ENUM ('baja', 'media', 'alta', 'urgente');

-- CreateTable
CREATE TABLE "mesa_ayuda"."departments" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesa_ayuda"."slas" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "priority" "mesa_ayuda"."TicketPriority" NOT NULL,
    "responseTimeMinutes" INTEGER NOT NULL,
    "resolutionTimeMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesa_ayuda"."help_topics" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesa_ayuda"."tickets" (
    "id" UUID NOT NULL,
    "ticket_number" SERIAL NOT NULL,
    "departmentId" UUID NOT NULL,
    "topicId" UUID NOT NULL,
    "status" "mesa_ayuda"."TicketStatus" NOT NULL DEFAULT 'abierto',
    "priority" "mesa_ayuda"."TicketPriority" NOT NULL DEFAULT 'media',
    "subject" VARCHAR(300) NOT NULL,
    "requestorEmail" TEXT NOT NULL,
    "requestorName" TEXT NOT NULL,
    "sessionToken" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "assignedToAgentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "slaVencimientoAt" TIMESTAMP(3),
    "slaCongeladoAt" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesa_ayuda"."ticket_messages" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesa_ayuda"."ticket_status_history" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "fromStatus" "mesa_ayuda"."TicketStatus" NOT NULL,
    "toStatus" "mesa_ayuda"."TicketStatus" NOT NULL,
    "changedByAgentId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesa_ayuda"."ticket_assignment_history" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "fromAgentId" UUID,
    "toAgentId" UUID,
    "assignedByAgentId" UUID,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesa_ayuda"."canned_responses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canned_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesa_ayuda"."kb_articles" (
    "id" UUID NOT NULL,
    "topicId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mesa_ayuda"."agents" (
    "id" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "agentUserId" UUID NOT NULL,
    "agentEmail" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxConcurrentTickets" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "mesa_ayuda"."departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "slas_departmentId_priority_key" ON "mesa_ayuda"."slas"("departmentId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "help_topics_name_key" ON "mesa_ayuda"."help_topics"("name");

-- CreateIndex
CREATE INDEX "help_topics_departmentId_idx" ON "mesa_ayuda"."help_topics"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "mesa_ayuda"."tickets"("ticket_number");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_sessionToken_key" ON "mesa_ayuda"."tickets"("sessionToken");

-- CreateIndex
CREATE INDEX "tickets_departmentId_idx" ON "mesa_ayuda"."tickets"("departmentId");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "mesa_ayuda"."tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_assignedToAgentId_idx" ON "mesa_ayuda"."tickets"("assignedToAgentId");

-- CreateIndex
CREATE INDEX "tickets_sessionToken_idx" ON "mesa_ayuda"."tickets"("sessionToken");

-- CreateIndex
CREATE INDEX "ticket_messages_ticketId_idx" ON "mesa_ayuda"."ticket_messages"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_messages_createdAt_idx" ON "mesa_ayuda"."ticket_messages"("createdAt");

-- CreateIndex
CREATE INDEX "ticket_status_history_ticketId_idx" ON "mesa_ayuda"."ticket_status_history"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_status_history_createdAt_idx" ON "mesa_ayuda"."ticket_status_history"("createdAt");

-- CreateIndex
CREATE INDEX "ticket_assignment_history_ticketId_idx" ON "mesa_ayuda"."ticket_assignment_history"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_assignment_history_createdAt_idx" ON "mesa_ayuda"."ticket_assignment_history"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "canned_responses_name_key" ON "mesa_ayuda"."canned_responses"("name");

-- CreateIndex
CREATE INDEX "canned_responses_category_idx" ON "mesa_ayuda"."canned_responses"("category");

-- CreateIndex
CREATE UNIQUE INDEX "kb_articles_title_key" ON "mesa_ayuda"."kb_articles"("title");

-- CreateIndex
CREATE INDEX "kb_articles_topicId_idx" ON "mesa_ayuda"."kb_articles"("topicId");

-- CreateIndex
CREATE INDEX "kb_articles_isPublished_idx" ON "mesa_ayuda"."kb_articles"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "agents_departmentId_agentUserId_key" ON "mesa_ayuda"."agents"("departmentId", "agentUserId");

-- AddForeignKey
ALTER TABLE "mesa_ayuda"."slas" ADD CONSTRAINT "slas_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "mesa_ayuda"."departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesa_ayuda"."help_topics" ADD CONSTRAINT "help_topics_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "mesa_ayuda"."departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesa_ayuda"."tickets" ADD CONSTRAINT "tickets_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "mesa_ayuda"."departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesa_ayuda"."tickets" ADD CONSTRAINT "tickets_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "mesa_ayuda"."help_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesa_ayuda"."ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "mesa_ayuda"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesa_ayuda"."ticket_status_history" ADD CONSTRAINT "ticket_status_history_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "mesa_ayuda"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesa_ayuda"."ticket_assignment_history" ADD CONSTRAINT "ticket_assignment_history_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "mesa_ayuda"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesa_ayuda"."kb_articles" ADD CONSTRAINT "kb_articles_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "mesa_ayuda"."help_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mesa_ayuda"."agents" ADD CONSTRAINT "agents_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "mesa_ayuda"."departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Añadido automáticamente desde apps/api/src/modules/mesa-ayuda/migration.extra.sql
-- (constraints que Prisma no sabe declarar: índice único parcial, CHECK, exclusion).
-- No editar aquí: se reescribe en cada generación. Ver D-049 y docs/09-incremento-d-cero-consola.md.
-- Constraints adicionales para mesa_ayuda que Prisma no expresa
-- (índices únicos parciales, CHECK, exclusión, etc.)
-- Anexado por el generador al final de la migración generada.

-- Índice único parcial: un solo ticket ABIERTO/EN_PROCESO por solicitante
-- (evita que un solicitante tenga múltiples tickets activos simultáneamente)
CREATE UNIQUE INDEX idx_tickets_open_per_requestor
  ON mesa_ayuda.tickets (requestorEmail)
  WHERE status IN ('abierto', 'en_proceso');

-- Índice único parcial: solo una asignación activa (isActive=true) por agente+departamento
CREATE UNIQUE INDEX idx_agents_active_per_dept
  ON mesa_ayuda.agents (agentUserId, departmentId)
  WHERE "isActive" = true;

-- CHECK constraint: resolutionTime > responseTime
ALTER TABLE mesa_ayuda.slas
  ADD CONSTRAINT sla_resolution_gt_response
  CHECK ("resolutionTimeMinutes" > "responseTimeMinutes");

-- CHECK constraint: priority enum válido (redundante con Prisma enum, pero documental)
ALTER TABLE mesa_ayuda.tickets
  ADD CONSTRAINT ticket_priority_valid
  CHECK (priority IN ('baja', 'media', 'alta', 'urgente'));

-- CHECK constraint: status enum válido
ALTER TABLE mesa_ayuda.tickets
  ADD CONSTRAINT ticket_status_valid
  CHECK (status IN ('abierto', 'en_proceso', 'resuelto', 'cerrado', 'reabierto'));
