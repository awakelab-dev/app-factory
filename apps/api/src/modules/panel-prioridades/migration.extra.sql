-- Constraint unique parcial para schedule_blocks: una sola tarea por franja (user_id, day_of_week, hour),
-- pero solo para bloques activos (no borrados/NULL). Regla de negocio (spec-tecnica.md):
-- "Unique (user_id, day_of_week, hour) — una sola tarea por franja". Prisma no sabe declarar
-- índices únicos parciales (solo @@unique total, que bloquearía re-reservar un hueco ya cancelado).
-- Esta constraint se anexa al migration.sql generado por "prisma migrate diff".
--
-- Sin esta constraint: si se borra un bloque (DELETE), se puede crear otro para el mismo hueco.
-- Caso: Usuario borra el bloque 9 de lunes (libera para reusar), luego crea uno nuevo en el mismo
-- lugar → sin constraint, ambos podrían coexistir (solo el no-NULL violaría UNIQUE total).

CREATE UNIQUE INDEX "schedule_blocks_user_day_hour_active_uniq"
  ON "panel"."schedule_blocks" ("userId", "dayOfWeek", "hour")
  WHERE "taskId" IS NOT NULL;
