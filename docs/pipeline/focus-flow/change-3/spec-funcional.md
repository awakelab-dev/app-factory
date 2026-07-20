# Spec funcional — `focus-flow` · change-3

> Artefacto del pipeline en modo `request_change` (docs/04, paso 2 — ANÁLISIS DE CAMBIO). Módulo YA desplegado (incluye ya change-1 y change-2). Este documento describe **solo el delta** sobre la spec funcional vigente y sobre `change-2` — no las repite. Para aprobación del solicitante (Leonardo, `leonardo.barreto@awakelab.dev`). Detalle técnico en `spec-tecnica.md`.

## Origen del cambio

Petición nueva de Leonardo (no es una corrección de un defecto, es una capacidad nueva): agregar en Configuración un campo de **horas proyectadas por día**, con valor por defecto **10 horas**, con la finalidad de poder evaluar desempeño comparando horas proyectadas contra horas realmente trabajadas.

## Qué está pasando hoy

La pantalla Configuración permite ajustar duración de fases, ciclos y automatizaciones/notificaciones (vigente + change-1). No existe ningún campo relacionado con una "meta" u "objetivo" de horas de trabajo por día. La pantalla Desempeño (`PerformancePage`) ya muestra series reales (pomodoros completados, % de tareas terminadas, % de foco efectivo, racha de días) calculadas a partir de las sesiones y tareas reales de la persona — pero **no muestra horas trabajadas en valor absoluto**, ni existe ningún punto de comparación contra una meta.

## Qué debe pasar (alcance de esta petición)

- En Configuración, una persona puede definir cuántas **horas por día** espera dedicar a trabajo enfocado (su propia meta personal, no un valor de equipo/organización). Por defecto, **10 horas** — igual que cualquier otro ajuste del módulo, aplica solo a quien lo configura, se guarda con el mismo botón "Guardar cambios" ya existente, y no afecta a nadie más.
- Este valor es un insumo (la "meta") para poder comparar, en algún momento, horas proyectadas vs. horas trabajadas — la propia petición lo dice como finalidad. Lo que **sí** entrega este change: el campo, su valor por defecto y su persistencia. Lo que se deja como **punto a confirmar** (ver abajo): si esta misma entrega debe incluir además el lugar donde se *ve* esa comparación (p. ej. en Desempeño), o si eso es una segunda entrega una vez validado que el campo en sí es el que se quiere.

## Qué NO cambia con esta petición

- No se toca el temporizador, la cola de tareas, el dashboard, ni el resto de Configuración (duración de fases, ciclos, automatizaciones, notificaciones) — vigentes tal cual.
- No se introduce ninguna vista de equipo/administrador: el valor sigue siendo estrictamente personal, visible y editable únicamente por quien lo configura, igual que el resto del módulo (nadie más, ni `admin`, ve u opera sobre la configuración de otra persona).
- No se cambia ningún rol ni el `module.manifest.ts`.

## Punto a confirmar con Leonardo antes de aprobar

- **¿Esta entrega incluye también mostrar la comparación "horas proyectadas vs. horas trabajadas" en alguna pantalla (p. ej. una tarjeta nueva en Desempeño), o solo agrega el campo en Configuración y dicha comparación queda para una entrega posterior?** La petición dice explícitamente "con la finalidad de evaluar desempeño", lo que sugiere que el campo por sí solo (sin ningún lugar donde se vea la comparación) no cumple el objetivo final de negocio. El análisis técnico (`spec-tecnica.md`) sí puede calcular "horas trabajadas" a partir de las sesiones reales ya existentes — no es un problema de datos, es una decisión de alcance de esta entrega concreta. Recomendación del análisis: **entregar el campo ahora** (rápido, bajo riesgo, ya es útil como registro de la meta) y, en un change-4 separado y explícito, añadir la comparación visual en Desempeño — así el PR de este cambio se mantiene pequeño y auditable. Confirmar si se prefiere en cambio incluir ambas cosas en un solo PR.
- **Granularidad del valor**: ¿"horas" admite medias horas (p. ej. 7.5 h, jornada habitual en muchas empresas) o solo horas completas? Recomendación: permitir medias horas (0.5 h) — es el mismo costo de implementación y cubre jornadas reales más variadas que un entero.

## Flags para el gate (docs/05 — por qué la revisión técnica es obligatoria)

- **Alcance ambiguo señalado por el propio análisis**: si esta entrega incluye o no la visualización de la comparación en Desempeño (ver punto a confirmar arriba) — criterio explícito de docs/05 para revisión obligatoria.
- **Migración de base de datos**: se añade una columna nueva a una tabla ya existente y propia del módulo (`focus.settings`) — de bajo riesgo (aditiva, con valor por defecto), pero se marca igual siguiendo el mismo criterio ya aplicado en `change-2`.
- **Finalidad declarada de evaluación de desempeño**: aunque el dato en sí (una meta numérica personal) no es más sensible que el resto de Configuración, la petición declara explícitamente su propósito como "evaluar desempeño" — un uso que, si en el futuro se expone a alguien distinto de la propia persona (un manager, RR.HH.), cambiaría la clasificación de privacidad del módulo (hoy: estrictamente personal, sin vista de equipo/admin). Se flaguea para que el gate confirme que esta entrega **no** abre ninguna vista de terceros sobre este dato — solo lo hace disponible para que la propia persona se autoevalúe.
