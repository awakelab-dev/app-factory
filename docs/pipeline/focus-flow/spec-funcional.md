# Spec funcional — `focus-flow`

> Artefacto del pipeline de Fase 1 (docs/04, paso 2 — ANÁLISIS). Este documento es para aprobación del solicitante (Leonardo, vía `leonardo.barreto@awakelab.world`). No contiene detalle técnico — ver `spec-tecnica.md`.

## Origen

Prototipo `FocusFlow` (carpeta `/Users/leonardobarreto/projects/app-factory/prototipos/focus-flow`), `index.html` único sin build system (CSS+JS inline, sin backend, Chart.js por CDN para los gráficos): temporizador Pomodoro personal con cola de tareas del día y dos pantallas de estadísticas. A diferencia de `orientadorIA`, este prototipo ya usa la identidad Awakelab 2026 tal cual (Poppins, paleta cian/azul, logo) — no hace falta rebranding. El chip de usuario está hardcodeado ("Leonardo", avatar "LB"): todo apunta a una herramienta pensada para uso personal de un individuo, no a un panel compartido de equipo.

## Qué hace hoy (estado del prototipo)

- **Temporizador Pomodoro**: tres modos (enfoque 25', descanso corto 5', descanso largo 15', configurables), anillo de progreso SVG, botones iniciar/pausar/reiniciar/saltar. Al completar un ciclo de enfoque suma un pomodoro a la tarea "actual" (la primera no completada de la cola) y dispara un toast + notificación del navegador (`Notification` API).
- **Cola de hoy / Tareas del día**: lista de tareas con nombre, pomodoros estimados/consumidos, checkbox de completado, arrastrar-y-soltar para reordenar, alta rápida. "Tareas del día" además muestra una estimación de hora de cierre y un resumen (nº tareas, % completado, pomodoros consumidos).
- **Dashboard**: tarjetas de KPI (tareas completadas/en curso, pomodoros de hoy, "foco efectivo") y dos gráficos (línea de minutos de enfoque por franja horaria, dona de distribución de tareas, barras de tiempo por proyecto).
- **Desempeño**: gráficos semanales/mensuales (pomodoros por día, tasa de finalización, tendencia de "foco efectivo" en 4 semanas) y tarjetas de racha/media.
- **Configuración**: duración de cada fase y nº de ciclos hasta descanso largo (steppers), interruptores de "iniciar descansos automáticamente", "iniciar pomodoro automáticamente", notificaciones push y sonido al terminar.

## Hallazgos relevantes del análisis (por qué esto no es un "cópialo tal cual")

1. **Cero persistencia**: todo vive en variables JS en memoria (`let tasks=[...]`, `let cfg={...}`). Recargar la página borra la cola de tareas y devuelve la configuración a sus valores por defecto — ni siquiera usa `localStorage`. Este es el problema que el MVP existe para resolver.
2. **Las estadísticas de Dashboard y Desempeño son 100% decorativas**: los números («3 tareas completadas», «82% foco efectivo», «41 pomodoros/semana», la línea de «minutos por franja horaria», la tendencia de 4 semanas…) son constantes escritas a mano en el JS, no se calculan a partir de lo que la persona realmente hizo. Hoy no hay ninguna relación entre completar un pomodoro real y lo que muestran esos paneles.
3. **Los interruptores de "iniciar automáticamente" no hacen nada**: al completar una fase, `phaseComplete()` siempre detiene el timer y espera a que el usuario pulse "Iniciar" de nuevo, sin mirar el estado de esos switches — es un control de UI sin lógica detrás. Lo mismo aplica al interruptor de "Sonido al terminar": no existe ningún archivo ni reproducción de audio en el código.
4. **Un único usuario implícito**: no hay login, no hay distinción de "de quién son estas tareas" — todo es "de quien tenga la pestaña abierta".

## Para quién

- Cualquier persona con cuenta en la plataforma Awakelab (rol `user` o `admin`, ya existentes en core — **ver "Preguntas abiertas" sobre si el MVP es solo para Leonardo o para cualquier autenticado**). Cada persona ve y gestiona **únicamente su propia** cola de tareas, configuración y estadísticas — no hay un rol nuevo, es aislamiento por fila (dueño = usuario autenticado), igual de estricto que si fuera un rol pero sin necesitar uno nuevo de manifest.
- No hay panel de administración ni vista agregada para otra persona (ni siquiera para `admin`) en este MVP — ver "Qué NO incluye" y "Preguntas abiertas".

## Flujo funcional (propuesto — reemplaza el estado en memoria del prototipo)

1. La persona entra con su cuenta de la plataforma (mismo mecanismo que cualquier módulo, JWT dev-login hoy / IdP mañana, D-011) — no hay login propio ni usuario hardcodeado.
2. **Enfoque**: mismo temporizador de tres modos, con la configuración propia de la persona (persistida, no vuelve a 25/5/15 al recargar). Al completar un ciclo de enfoque, se registra en el backend (para que el Dashboard/Desempeño reflejen actividad real) y se suma el pomodoro a la tarea actual.
3. **Tareas del día**: la cola persiste entre sesiones/recargas/dispositivos — se puede cerrar el navegador a mitad de tarde y seguir donde quedó. Reordenar, marcar completado y estimar pomodoros funciona igual que hoy.
4. **Dashboard / Desempeño**: los KPIs y gráficos se calculan a partir de los ciclos de enfoque y tareas reales de la persona (pomodoros completados hoy/semana, tareas completadas, racha de días con actividad) — **deja de haber números inventados**.
5. **Configuración**: duración de fases, ciclos hasta descanso largo, y los interruptores de automatización/notificaciones/sonido — persistidos, y **con efecto real** (ver Preguntas abiertas sobre cuáles de estos vale la pena implementar de verdad para el MVP vs. dejarlos fuera si no aportan).

## Qué NO incluye este MVP (fuera de alcance, a menos que se pida explícitamente)

- **Vista de equipo/administrador**: ningún rol (ni `admin`) ve las tareas, tiempos o estadísticas de otra persona en este MVP — es una herramienta de productividad personal, no un panel de supervisión. Si más adelante se quiere un agregado de equipo, es una extensión deliberada (con sus propias implicaciones de privacidad), no algo que se cuela por defecto.
- **Integración con `gestor-proyectos`**: las tareas de FocusFlow son una lista personal independiente, no están ligadas a los proyectos/sprints/tareas de `gestor-proyectos` (que sí exige proyecto+sprint y es de uso de equipo). Traer las tareas asignadas a uno mismo desde `gestor-proyectos` a la cola de FocusFlow es una integración futura razonable, no de este MVP — ver "Preguntas abiertas".
- **Notificaciones más allá del navegador** (push tras cerrar la pestaña, email, app móvil): se mantiene igual que hoy, mejor esfuerzo vía `Notification` API del navegador.
- **Historial/calendario completo** de días pasados más allá de lo que ya muestra "Desempeño" (semana/4 semanas): una vista de calendario/histórico detallado por día es una extensión futura.
- **Sonido real al terminar una fase**: el prototipo ya no lo tenía implementado (el interruptor no hacía nada); implementarlo de verdad es una mejora menor, no bloqueante — ver "Preguntas abiertas".

## Flags para el gate (docs/05 — por qué la revisión técnica es obligatoria)

- **Primer módulo de este tipo/patrón**: primer módulo de datos estrictamente personales/privados de productividad (cada usuario ve solo lo suyo, sin vista de equipo ni de administrador) — distinto de los patrones ya calibrados (panel de equipo con permisos por fila de `gestor-proyectos`, panel admin de un cliente externo de `orientador-ia`, réplica de solo lectura de `moodle-insights`). Calibración necesaria.
- **Alcance ambiguo señalado por el propio análisis**: (1) ¿es una herramienta solo para Leonardo o para cualquier persona con cuenta en la plataforma?, (2) ¿se integra con las tareas de `gestor-proyectos` o queda independiente? — ver "Preguntas abiertas", no se resuelve unilateralmente aquí.
- **Decisión de dependencia externa evitable**: el prototipo usa Chart.js por CDN; la plataforma ya tiene `recharts` como librería de gráficos (`moodle-insights`) — la recomendación por defecto es reutilizar `recharts` y no añadir una segunda librería de charts, pero es una decisión que debe confirmarse en el gate técnico.
- **Contenido libre**: los nombres de tarea son texto libre y podrían mencionar información interna/confidencial de un proyecto o cliente de Awakelab (mismo matiz ya aceptado en `gestor-proyectos` para comentarios de tarea) — se trata con RBAC de fila + auditoría, sin necesitar RLS (no es un dato de terceros, es del propio usuario que lo escribió).

## Preguntas abiertas para Leonardo (antes de aprobar esta spec)

1. **¿Para quién es este módulo?** ¿Herramienta solo para Leonardo (acceso restringido, aunque sea vía el mismo mecanismo de rol acotado que `orientador_admin`), o disponible para cualquier persona con cuenta en la plataforma Awakelab (cada quien con su propia cola/estadísticas, sin rol nuevo)? Recomendación del análisis: cualquier autenticado — es el diseño más simple (reutiliza `user`/`admin` tal cual, sin rol nuevo) y no cuesta más construirlo así.
2. **¿Se integra con `gestor-proyectos`?** ¿La cola de "Tareas del día" es una lista personal independiente (como hoy en el prototipo), o debería poder traer/reflejar las tareas de `gestor-proyectos` asignadas a la persona? Recomendación: independiente para el MVP — evita acoplar dos módulos y una integración cruzada antes de validar que el primero se usa; se puede revisar después con datos reales de uso.
3. **Librería de gráficos**: ¿confirmar reutilizar `recharts` (ya en la plataforma) en vez de Chart.js del prototipo? Recomendación: sí, evita una dependencia nueva.
4. **Automatizaciones de Configuración**: los interruptores "iniciar descansos/pomodoro automáticamente" y "sonido al terminar" no funcionan hoy en el prototipo (son controles sin lógica). ¿Se implementan de verdad para el MVP (tienen valor real de producto) o se quitan de la pantalla de Configuración hasta que se decida hacerlo bien? Recomendación: implementar el autoarranque de fases (es barato y es justo el propósito del ajuste); dejar "sonido al terminar" fuera del MVP salvo que se pida explícitamente (requiere decidir un archivo de audio y no estaba implementado ni en el original).
5. **Selección manual de "tarea actual"**: hoy el pomodoro siempre se acredita a la primera tarea no completada de la cola (sin poder elegir otra). ¿Se mantiene así para el MVP, o hace falta poder elegir explícitamente qué tarea está "en curso"? Recomendación: mantener el comportamiento del prototipo, es simple y ya validado.
