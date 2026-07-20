-- focus-flow · change-3: meta personal de horas de enfoque por día.
-- Aditiva sobre la tabla propia del módulo (focus.settings); 600 min = 10 h.
-- Mismo patrón de tipado en minutos (Int) que focusMinutes/shortBreakMinutes.
ALTER TABLE "focus"."settings" ADD COLUMN "projectedFocusMinutesPerDay" INTEGER NOT NULL DEFAULT 600;
