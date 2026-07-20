# Spec funcional — `focus-flow` · change-2

> Artefacto del pipeline en modo `request_change` (docs/04, paso 2 — ANÁLISIS DE CAMBIO). Módulo YA desplegado; este documento describe **solo el delta** sobre la spec funcional vigente (`docs/pipeline/focus-flow/spec-funcional.md`), no la repite. Para aprobación del solicitante (Leonardo, `leonardo.barreto@awakelab.world`). Detalle técnico en `spec-tecnica.md`.

## Origen del cambio

Dos correcciones reportadas por Leonardo tras validar `focus-flow` en staging (no son ideas nuevas de producto, son defectos/limitaciones encontrados en lo ya construido).

## Cambio 1 — Interruptores de Configuración muestran el estado equivocado

**Qué está pasando hoy**: en la pantalla Configuración, los tres interruptores ("Iniciar descansos automáticamente", "Iniciar pomodoro automáticamente", "Notificaciones push") dibujan el círculo blanco en la posición incorrecta: en OFF aparece corrido hacia la derecha (parece encendido a simple vista) y en ON se sale por el borde derecho del botón. El estado real que se guarda es correcto (si se prueba con el lector de pantalla o revisando qué se envía al guardar, el valor es el que corresponde) — es un defecto puramente visual, no de datos.

**Qué debe pasar**: el círculo debe reflejar el estado real y quedar siempre dentro del botón — apagado (OFF) con el círculo pegado a la izquierda, encendido (ON) con el círculo pegado a la derecha, sin desbordarse en ningún caso. Nada más cambia: mismas tres opciones, mismo efecto al guardar, mismo comportamiento funcional ya vigente.

**Impacto**: ninguno sobre datos ni sobre otras pantallas — únicamente arregla cómo se ve algo que ya funciona por debajo.

## Cambio 2 — El temporizador en curso se pierde al recargar o reiniciar el navegador

**Qué está pasando hoy**: si hay un ciclo de enfoque o descanso corriendo y la persona recarga la página o cierra y vuelve a abrir el navegador, el ciclo en curso se pierde y el temporizador vuelve a arrancar desde cero (25:00 de enfoque, o el valor configurado). Esto es una limitación conocida y documentada del MVP original ("decisión 6" del gate funcional): se aceptó para el primer lanzamiento porque implementarlo bien no era trivial y no bloqueaba la validación en staging. Habiendo validado ya, Leonardo pide revertir esa limitación.

**Qué debe pasar**: el ciclo activo (en qué fase está — enfoque/descanso corto/descanso largo —, cuánto tiempo le queda, si está corriendo o en pausa, y qué tarea tiene asociada) debe sobrevivir a recargar la página o reiniciar el navegador, y retomarse donde estaba. Solo se pierde si el navegador estuvo cerrado más tiempo del que le quedaba a la fase — ver "Punto a confirmar" abajo sobre qué hacer en ese caso límite.

**Cómo se propone guardarlo** (detalle técnico completo en `spec-tecnica.md`): el mismo patrón que ya usa todo `focus-flow` para el resto de sus datos — se guarda en la base de datos de la plataforma, asociado únicamente a la cuenta de quien lo generó, con el mismo control de acceso estricto que ya aplica a la configuración, las tareas y el historial de sesiones de este módulo (nadie más, ni siquiera un administrador, puede ver o reanudar el ciclo de otra persona). Se descarta guardarlo solo en el navegador (`localStorage`) porque, si el equipo/perfil de navegador lo comparte más de una persona, no distingue de quién es cada ciclo tan bien como guardarlo del lado del servidor asociado a la cuenta — y guardarlo en servidor ya es gratis en este módulo porque el patrón ya existe para todo lo demás.

**Efecto colateral positivo (no pedido, pero gratuito con este enfoque)**: como queda asociado a la cuenta y no al navegador, de paso el ciclo también podría retomarse si la persona abre `focus-flow` desde otro dispositivo — no es el objetivo de esta petición, pero no cuesta nada extra y no se excluye.

**No cambia**: el conteo del temporizador sigue corriendo en el navegador de la persona (no se vuelve un cronómetro "en vivo" sincronizado con el servidor ni se añade ningún mecanismo de tiempo real) — solo se guardan puntos de referencia (en qué fase está, desde cuándo, cuánto llevaba) para poder reconstruir el tiempo restante al volver a abrir la pantalla. Esto es exactamente la alternativa que la spec técnica vigente ya había dejado anotada como "fase 2 razonable" para este mismo caso.

## Punto a confirmar con Leonardo antes de aprobar

- **¿Qué pasa si el navegador estuvo cerrado más tiempo del que le quedaba a la fase?** (p. ej. quedaban 10 minutos de enfoque y el navegador estuvo cerrado 2 horas). Recomendación del análisis: al reabrir, mostrar la fase "vencida" en pausa con 00:00 y dejar que la persona pulse "Iniciar" para que el ciclo se cierre normalmente (se registra con el tiempo real que efectivamente corrió) — **no** se completa ni se descarta el ciclo de forma automática y silenciosa mientras el navegador estaba cerrado, porque no hay forma honesta de saber si de verdad se mantuvo el enfoque. Confirmar si este comportamiento es el deseado.

## Qué NO cambia con esta petición

- No se toca ninguna otra pantalla, endpoint o dato del módulo más allá de lo descrito arriba.
- No se amplía el alcance de usuarios ni se introduce ningún rol o vista nueva (sigue siendo estrictamente personal, sin vista de equipo/admin — decisión ya vigente).
- No se retoma la integración con `gestor-proyectos` ni ninguna otra pregunta abierta de la spec funcional original: este change-2 es exclusivamente las dos correcciones descritas.

## Flags para el gate (docs/05 — por qué la revisión técnica es obligatoria)

- **Dato personal**: el cambio 2 hace que el servidor guarde, aunque sea de forma mínima, una foto del progreso en tiempo real de la persona (en qué fase está, si está corriendo, desde cuándo) — un nivel de detalle más granular que lo ya persistido (configuración/tareas/sesiones cerradas). Mismo criterio de privacidad que el resto del módulo (dato propio, sin vista de equipo/admin), pero al ser un dato nuevo se revisa igual, sin rebajar la clasificación existente.
- **Migración de base de datos**: el cambio 2 añade una tabla nueva (propia del schema `focus`, no toca `core` ni otro módulo — ver `spec-tecnica.md`), lo cual entra en el criterio de revisión obligatoria por "migración" aunque sea de bajo riesgo.
- El cambio 1 (interruptores) no dispara ningún criterio de docs/05 por sí solo — se incluye en el mismo gate por ir empaquetado junto al cambio 2 en el mismo PR incremental.
