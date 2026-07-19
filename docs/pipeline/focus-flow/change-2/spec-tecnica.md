# Spec técnica — `focus-flow` · change-2

> Artefacto del pipeline en modo `request_change` (docs/04, paso 2). Delta sobre `docs/pipeline/focus-flow/spec-tecnica.md` (vigente) — no se repite el diseño ya generado/desplegado, solo lo que cambia. Código vivo leído entero antes de este análisis: `apps/api/src/modules/focus-flow/` y `apps/web/src/modules/focus-flow/`.

## Score de complejidad y por qué el gate es obligatorio

Del **cambio**, no del módulo (docs/05):

- **Cambio 1** (interruptores): trivial, puramente visual, un solo archivo, sin backend ni migración.
- **Cambio 2** (persistencia del temporizador): añade una entidad nueva + 2 endpoints + migración (propia del schema `focus`, sin tocar `core` ni otro módulo) + reescritura parcial de `useFocusTimer`/`FocusPage` para hidratar/emitir estado. No introduce RBAC nuevo, no introduce dependencia externa, no toca otro módulo — pero sí es una migración de datos personales nueva y deja un punto de diseño abierto (fase "vencida" al reanudar) que requiere confirmación explícita, no autoaprobable por muestreo.

Complejidad combinada del change-2: **moderada**, dominada por el cambio 2. No aplica auto-aprobación por muestreo (dato personal nuevo + migración, criterios de docs/05).

## Cambio 1 — Interruptores (`Switch`) de Configuración

**Archivo único afectado**: `apps/web/src/modules/focus-flow/SettingsPage.tsx` (componente `Switch`, líneas ~202-221). Usado en las tres filas de `SettingRow` de "Comportamiento y notificaciones" (`auto-start-breaks`, `auto-start-focus`, `notifications-enabled`) — no existe en ningún otro módulo ni en `packages/ui` (confirmado: no hay `Switch`/`Toggle` compartido en `packages/ui/src`, y ningún otro módulo web define uno propio) — es un componente local de `focus-flow`, sin superficie de reutilización externa ni consumidores fuera de este archivo.

**Causa raíz**: el círculo (`<span>`) se posiciona únicamente con `transform: translate-x-*` (`translate-x-0.5` en OFF, `translate-x-6` en ON) sin un ancla explícita (`left`/`inset`) — depende del algoritmo de posición estática de un elemento `absolute` sin `left` declarado, que no garantiza el offset base que el cálculo de las clases `translate-x-*` asume. Resultado: el círculo no queda correctamente contenido dentro del track (`h-7 w-12`) en ninguno de los dos estados.

**Corrección propuesta**: fijar un ancla explícita y determinística para el thumb (p. ej. `inset-y-1 left-1` como base) y un `translate-x` calculado para que, en ON, el círculo quede exactamente pegado al borde derecho interior del track (track `w-12` menos thumb `h-5 w-5` menos los insets — sin depender de la posición estática implícita del navegador). Puramente CSS/JSX — mismos `data-testid` (`auto-start-breaks`, `auto-start-focus`, `notifications-enabled`), mismos `role="switch"`/`aria-checked`, mismo comportamiento de `onChange`. No requiere cambios en `focus-flow.types.ts`, API, ni tests existentes (`SettingsPage.test.tsx` no hace aserciones sobre clases de posición del thumb hoy — se recomienda añadir una aserción de estado visual por `aria-checked` al implementar, no bloqueante para esta mini-spec).

**Reutilización**: ninguna nueva; se descarta extraer un `Switch` compartido a `packages/ui` en este change (fuera de alcance de una corrección de bug — si se quiere, es una refactorización aparte a proponer explícitamente, no implícita en este PR).

## Cambio 2 — Persistencia del ciclo activo del temporizador

Revierte la limitación de "Temporizador — qué vive en el cliente vs. qué se persiste" de la spec técnica vigente ("decisión 6": recargar a mitad de ciclo lo pierde). El principio de diseño que **no** cambia: el conteo en curso sigue siendo responsabilidad del cliente (`setInterval` de 1s, sin timer server-authoritative, sin websockets/polling) — este change solo añade **puntos de referencia persistidos** para reconstruir el tiempo restante al recargar/reabrir, exactamente la alternativa que la spec vigente ya dejaba anotada como aditiva y no bloqueante.

### Modelo de datos — nueva tabla `focus.timer_state`

Fila única por usuario (mismo patrón lazy-upsert que `focus.settings`), separada de `focus.settings` a propósito: `settings` son preferencias que solo cambian vía el botón explícito "Guardar cambios" de `SettingsPage`; `timer_state` es estado de ejecución efímero que se sobrescribe automáticamente en cada acción del timer — mezclarlos en la misma fila arriesga que una sincronización en segundo plano pise una edición de preferencias no guardada, o viceversa.

```
focus.timer_state
  id, user_id (uuid de core.users, unique — mismo patrón conceptual que el resto del módulo, sin FK cross-schema)
  phase (enum: focus | short_break | long_break)
  round (int)
  task_id (nullable — igual que focus.sessions.task_id, copia conceptual, sin FK)
  phase_started_at (timestamptz, nullable — instante en que arrancó el tramo "corriendo" actual; null si está en pausa)
  accumulated_seconds (int, default 0 — segundos ya transcurridos de la fase antes del último pause/resume)
  running (bool, default false)
  updated_at
```

Reconstrucción al reanudar (lado cliente, tras `GET /timer-state`):
`remainingSeconds = max(0, nominal(phase) - accumulated_seconds - (running ? (now - phase_started_at) : 0))`.

**Migración**: aditiva, exclusivamente en el schema `focus` (propio del módulo) — no altera columnas de `focus.settings`/`focus.tasks`/`focus.sessions`, no toca `core` ni ningún otro schema. Bajo riesgo de rollback (tabla nueva, sin backfill).

**Privacidad**: mismo control que el resto de `focus-flow` — filtrado obligatorio por `user_id = request.user.id` en el servicio, sin excepción para `admin` (consistente con `focus.settings`/`focus.tasks`/`focus.sessions`); no hace falta Row-Level Security de Postgres (mismo criterio ya aplicado al resto del módulo: dato personal, no confidencial). Se marca igualmente para revisión porque es una clase de dato nueva (estado de actividad en progreso, no solo resultados cerrados) — ver `meta.json`.

### Endpoints nuevos (`apps/api/src/modules/focus-flow/`)

| Método/ruta | Función |
|---|---|
| `GET /api/focus-flow/timer-state` | Devuelve el estado persistido del usuario, o `null` si nunca corrió un timer (usuario nuevo) |
| `PUT /api/focus-flow/timer-state` | Upsert del estado — el cliente lo llama en cada evento discreto (`toggleTimer` play/pausa, `changeMode`, `resetTimer`, transición de fase vía `finishPhase`), **no** en cada tick de 1 segundo (evita escrituras cada segundo; respeta que el servidor no es la autoridad del conteo) |

Ambos siguen el mismo patrón que el resto del controlador: sin `@Roles`, filtrado implícito por `CurrentUser()`, `ZodValidationPipe` para el body de `PUT`. No se añade `DELETE`: el reposo tras completar un ciclo entero también se refleja como upsert (fase `focus`, ronda 1, `running=false`).

### Frontend (`apps/web/src/modules/focus-flow/`)

- **`use-focus-timer.ts`**: añade `initialState?: { phase, round, remainingSeconds, running }` opcional a `UseFocusTimerOptions` (si se pasa, hidrata el estado inicial del hook en vez de arrancar siempre en `nominalSeconds('focus', settings)`); añade un nuevo callback `onStateChange` simétrico a `onSessionComplete`, invocado en los mismos puntos discretos que dispararán el `PUT /timer-state` (fire-and-forget, mismo manejo de error best-effort que ya usa `onSessionComplete` en `FocusPage`).
- **`FocusPage.tsx`**: `load()` pasa de `Promise.all([settings, tasks])` a `Promise.all([settings, tasks, timerState])`; si `timerState` no es `null`, se pasa como `initialState` a `useFocusTimer`. `onStateChange` se conecta a `PUT /timer-state` igual que `onSessionComplete` se conecta hoy a `POST /sessions`.
- Sin cambios en `TasksPage`, `DashboardPage`, `PerformancePage`, `FocusTaskQueue`, `module.manifest.ts` ni en el resto de rutas/roles.
- Tests afectados: `use-focus-timer.test.ts` (nuevos casos para `initialState` e invocaciones de `onStateChange`) y `FocusPage.test.tsx` (mock de `GET /timer-state`). No afecta `SettingsPage.test.tsx`, `TasksPage.test.tsx`, `DashboardPage.test.tsx`, `PerformancePage.test.tsx`.

### Alternativa descartada: `localStorage`

Se descarta como mecanismo principal: (a) rompe el patrón ya establecido en todo el módulo de que el dato personal vive en Postgres filtrado por `userId`, no en el dispositivo; (b) en un navegador/perfil compartido por más de una persona no distingue de quién es el ciclo sin un namespacing manual poco confiable; (c) la petición pide explícitamente respetar que el dato es personal por usuario, lo que el enfoque server-side ya garantiza con el mismo mecanismo que el resto del módulo, sin costo adicional de diseño.

### Abierto (a resolver en el gate, ver también spec-funcional.md)

- **Fase "vencida" al reanudar** (navegador cerrado más tiempo del que quedaba): propuesta del análisis — al hidratar con `remainingSeconds` calculado en 0, dejar `running=false` y esperar a que la persona pulse "Iniciar" (dispara el `finishPhase` normal, registrando el tiempo real transcurrido); no se autocompleta ni se descarta la fase de forma silenciosa mientras el navegador estaba cerrado. Confirmar antes de implementar.
- **Frecuencia de `PUT /timer-state`**: la lista de eventos discretos de arriba (play/pausa/cambio de modo/reset/fin de fase) se considera suficiente y barata; si en el gate se pide también sincronizar periódicamente mientras corre (p. ej. cada 30s, por si el tab se mata sin evento discreto — cierre abrupto del proceso del navegador), es aditivo y no cambia el modelo de datos, solo la cadencia de llamadas del cliente.
