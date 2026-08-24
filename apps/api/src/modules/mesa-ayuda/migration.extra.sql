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
