-- Constraints adicionales para mesa_ayuda que Prisma no expresa
-- (índices únicos parciales, CHECK, exclusión, etc.)
-- Anexado por el generador al final de la migración generada.

-- Índice único parcial: una sola asignación activa por agente y departamento.
-- Los identificadores van entrecomillados: sin comillas Postgres los pasa a
-- minúsculas ("agentuserid") y no existen, que es lo que rompía la migración.
CREATE UNIQUE INDEX idx_agents_active_per_dept
  ON mesa_ayuda.agents ("agentUserId", "departmentId")
  WHERE "isActive" = true;

-- CHECK: el plazo de resolución tiene que ser mayor que el de respuesta.
ALTER TABLE mesa_ayuda.slas
  ADD CONSTRAINT sla_resolution_gt_response
  CHECK ("resolutionTimeMinutes" > "responseTimeMinutes");

-- RETIRADO: índice único parcial "un solo ticket abierto por solicitante"
-- (idx_tickets_open_per_requestor). Además de romper por el mismo problema de
-- comillas, la regla de negocio es falsa: impedía que una misma persona tuviera
-- dos peticiones abiertas a la vez. Nadie la pidió y contradice el prototipo,
-- donde un mismo solicitante tiene varias en curso.
--
-- RETIRADOS: los CHECK de `priority` y `status` contra listas de literales.
-- Ambas columnas son de tipo enum de Postgres, así que el propio tipo ya
-- restringe los valores; el CHECK no añadía nada y este archivo es solo para
-- lo que Prisma NO sabe declarar.
