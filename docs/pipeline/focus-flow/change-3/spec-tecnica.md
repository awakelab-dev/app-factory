# Spec técnica — `focus-flow` · change-3

> Artefacto del pipeline en modo `request_change` (docs/04, paso 2). Delta sobre la spec técnica vigente + `change-2` (ya desplegado) — no se repite el diseño ya generado, solo lo que cambia. Código vivo leído entero antes de este análisis: `apps/api/src/modules/focus-flow/` y `apps/web/src/modules/focus-flow/` (incluye `focus-flow-settings.service.ts`, `focus-flow.types.ts`, `SettingsPage.tsx`, `focus-flow-stats.service.ts`, `PerformancePage.tsx`, y el modelo Prisma `focus.settings`/`focus.timer_state` en `apps/api/prisma/schema.prisma`).

## Score de complejidad y por qué el gate es obligatorio

Del **cambio**, no del módulo (docs/05): técnicamente es **bajo** (una columna aditiva sobre una tabla ya existente y propia del módulo, cero entidades nuevas, cero endpoints nuevos, un solo archivo de pantalla tocado en el frontend, cero dependencias externas, cero RBAC nuevo). Lo que fuerza el gate no es la dificultad de construirlo sino el **alcance ambiguo** señalado en `spec-funcional.md`: la petición declara una finalidad ("evaluar desempeño: horas proyectadas vs. trabajadas") que el alcance literal descrito aquí ("un campo en Configuración") no cierra por sí solo — falta decidir si esta entrega incluye o no dónde se muestra esa comparación. Docs/05 marca explícitamente "alcance ambiguo señalado por el propio análisis" como criterio de revisión obligatoria, independientemente del score.

## Alcance de esta entrega (lo que SÍ construye este change-3)

Solo el campo de Configuración, su persistencia y su valor por defecto. **No** incluye ninguna pantalla ni cálculo de "horas trabajadas" comparadas contra la meta — ver "Fuera de alcance / propuesta para change-4" abajo, y el punto a confirmar en `spec-funcional.md`.

## Modelo de datos — columna nueva en `focus.settings`

Reutiliza la tabla ya existente (mismo patrón que el resto de Configuración: una fila por usuario, upsert perezoso vía `FocusSettingsService.getOrCreate`) — **no** se crea una tabla nueva ni una entidad nueva.

```
focus.settings
  ...columnas ya existentes (focusMinutes, shortBreakMinutes, longBreakMinutes,
     roundsBeforeLongBreak, autoStartBreaks, autoStartFocus, notificationsEnabled)...
  + projectedFocusMinutesPerDay  Int  @default(600)   -- NUEVA
```

**Por qué en minutos y no en horas (`Float`/`Decimal`) en la base de datos**: todas las columnas de duración de este módulo ya están en minutos como `Int` (`focusMinutes`, `shortBreakMinutes`, `longBreakMinutes`) — se reutiliza exactamente ese patrón en vez de introducir un tipo de dato nuevo (`Float`/`Decimal`) solo para esta columna. `600` minutos = 10 horas (el valor por defecto pedido). Guardar en minutos, no en horas enteras, es además lo que permite honrar la granularidad de media hora que se recomienda confirmar en `spec-funcional.md` (p. ej. 7.5 h = 450) sin cambiar el tipo de columna.

**Rango**: `min 60` (1 h) `max 1440` (24 h) — mismo criterio de cota amplia y no intrusiva que el resto de los campos de Configuración (p. ej. `focusMinutes` acepta hasta 180). Validado en el mismo `updateFocusSettingsRequestSchema` (Zod), no en la base de datos.

**Migración**: aditiva, exclusivamente en el schema `focus`, sobre una tabla que el módulo ya posee — no altera `focus.tasks`/`focus.sessions`/`focus.timer_state`, no toca `core` ni ningún otro schema. Riesgo de rollback bajo: `ADD COLUMN ... DEFAULT 600` puebla las filas existentes sin backfill manual. Mismo criterio de "se marca para revisión aunque sea de bajo riesgo" ya aplicado en `change-2`.

**Privacidad**: mismo control ya vigente para toda `focus.settings` — filtrado por `userId = request.user.id`, sin excepción para `admin`. No es una clase de dato nueva (es un ajuste numérico, de la misma naturaleza que `focusMinutes`), así que no se eleva la clasificación de privacidad del módulo; se deja constancia igualmente en `meta.json` por la finalidad declarada de "evaluación de desempeño" (ver `spec-funcional.md`, punto a confirmar).

## Backend (`apps/api/src/modules/focus-flow/`)

- **`focus-flow.types.ts`**: añade `projectedFocusMinutesPerDay: z.number().int()` a `focusSettingsSchema`, y `projectedFocusMinutesPerDay: z.number().int().min(60).max(1440).optional()` a `updateFocusSettingsRequestSchema`.
- **`focus-flow-settings.service.ts`**: añade `projectedFocusMinutesPerDay: 600` a `SETTINGS_DEFAULTS`. `getOrCreate`/`update` no cambian de forma (siguen siendo upserts genéricos sobre el objeto completo) — el campo nuevo viaja igual que los demás sin lógica adicional.
- **`focus-flow.mappers.ts`**: `toSettingsDto` ya mapea la fila de Prisma campo a campo; se añade la línea correspondiente al campo nuevo (mismo patrón, sin transformación).
- **Endpoints**: **ninguno nuevo**. Reutiliza `GET /api/focus-flow/settings` y `PUT /api/focus-flow/settings` ya existentes — el campo viaja dentro del mismo payload.
- **Sin cambios** en `focus-flow-stats.service.ts`, `focus-flow-sessions.service.ts`, `focus-flow-tasks.service.ts`, `focus-flow-timer-state.service.ts` ni `focus-flow.controller.ts` (más allá de que el DTO de settings ahora trae un campo más, sin tocar la firma de ningún método del controller).

## Frontend (`apps/web/src/modules/focus-flow/`)

- **`focus-flow.types.ts`** (espejo web): mismo campo añadido a `focusSettingsSchema` y a la interfaz `UpdateFocusSettingsRequest`.
- **`SettingsPage.tsx`**: nueva fila en la tarjeta "Temporizadores" (o una tercera tarjeta "Meta diaria", a decidir en implementación — cosmético, no afecta el contrato) con un control de horas. El `Stepper` existente (líneas ~164-200) incrementa/decrementa de 1 en 1 sobre el valor mostrado tal cual — no sirve tal cual porque el valor almacenado está en minutos y se quiere que la persona piense en horas (incluyendo medias horas, ver punto a confirmar). Se añade un componente `HourStepper` local (mismo archivo, mismo patrón visual que `Stepper`) que:
  - muestra el valor formateado en horas (`10 h`, `7.5 h`),
  - incrementa/decrementa de 30 en 30 minutos (medio en medio de hora) sobre `projectedFocusMinutesPerDay`,
  - reutiliza los mismos `data-testid` (`{testId}-decrement`/`{testId}-increment`/`{testId}-value`) que `Stepper`, mismo criterio de testabilidad ya vigente.
  - Si en el gate se confirma que solo se quieren horas completas (ver punto a confirmar en `spec-funcional.md`), el cambio se reduce a incrementar de 60 en 60 minutos — no cambia el modelo de datos ni el endpoint, solo el paso del stepper.
- `onSave` añade `projectedFocusMinutesPerDay: state.settings.projectedFocusMinutesPerDay` al body del `PUT`, igual que el resto de campos.
- **Sin cambios** en `TasksPage.tsx`, `DashboardPage.tsx`, `PerformancePage.tsx`, `FocusPage.tsx`, `use-focus-timer.ts`, `FocusTaskQueue.tsx`, `module.manifest.ts` ni en rutas/roles.
- Tests afectados: `focus-flow-settings.service.spec.ts` (defaults/upsert incluyen el campo nuevo), `SettingsPage.test.tsx` (nuevo control, valor por defecto 10 h, guardado). No afecta `PerformancePage.test.tsx`, `DashboardPage.test.tsx`, `TasksPage.test.tsx`, `FocusPage.test.tsx`, `use-focus-timer.test.ts`.

## Fuera de alcance de este change-3 / propuesta para un change-4 separado

La finalidad declarada ("evaluar desempeño: horas proyectadas vs. trabajadas") solo queda completamente resuelta cuando exista un lugar que muestre la comparación. Se deja documentado aquí el diseño que **seguiría** (para el change-4, si Leonardo confirma que es un paso separado — ver `spec-funcional.md`), sin implementarlo en este PR:

- `focus-flow-stats.service.ts` ya calcula, por bloque (`computePoints`), sesiones de fase `focus` completadas en ese rango de fechas — hoy solo deriva `pomodorosCompleted`/`tasksCompletionRatePct`/`effectiveFocusPct`. Sumar `durationSeconds` de esas mismas sesiones ya filtradas (sin queries nuevas) da "horas trabajadas" por bloque; se compara contra `projectedFocusMinutesPerDay × días del bloque` (1 para `week`, 7 para cada bloque de `month`) para dar un `%` de cumplimiento, exactamente el mismo patrón de cálculo en memoria que ya usa el resto del servicio.
- Requeriría añadir un campo (p. ej. `workedMinutes`, `projectedMinutes`) a `focusPerformancePointSchema` y una tarjeta/gráfico nuevo en `PerformancePage.tsx` — cambio de tamaño similar al de este change-3, deliberadamente no incluido aquí para mantener este PR pequeño y auditable.

## Reutilización (resumen)

Este change-3 reutiliza el 100% de la infraestructura ya existente de Configuración: la misma tabla (`focus.settings`), el mismo servicio (`FocusSettingsService`), los mismos endpoints (`GET`/`PUT /settings`), el mismo mapper, el mismo botón "Guardar cambios" y el mismo patrón visual de control numérico (`Stepper`, extendido a `HourStepper`). No se toca ningún otro módulo, no se añade ninguna dependencia externa, no se introduce RBAC nuevo. Es, deliberadamente, el cambio más pequeño posible que satisface el texto literal de la petición ("un campo... en Configuración, por defecto 10 horas"), dejando la parte de visualización/comparación (la "finalidad") como una decisión de alcance explícita para el gate.
