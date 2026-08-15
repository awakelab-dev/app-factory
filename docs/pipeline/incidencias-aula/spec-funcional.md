# Spec funcional — `incidencias-aula`

> Artefacto del pipeline (docs/04, paso 2 — ANÁLISIS). Enviado por Cowork (`submit_prototype`) por leonardo.barreto@awakelab.dev. Documento para aprobación de quien encarga — no contiene detalle técnico, ver `spec-tecnica.md`.

## Origen

Prototipo `Registro de Incidencias de Aula` recibido vía el conector `awkfactory` (HTML autocontenido + `prototype.manifest.json`, docs/pipeline/incidencias-aula/source/), sin backend: los datos viven en memoria del navegador y se pierden al recargar. Incluye un selector "Ver como" (Docente / Coordinación / Dirección) para simular los tres roles sobre los mismos datos de demostración — dato explícito del propio prototipo: son inventados, ningún alumno real.

## Qué hace hoy (estado del prototipo)

Centraliza el registro y seguimiento de incidencias de aula de un centro de FP, con tres vistas:

1. **Docente**: da de alta un parte (alumno, aula, tipo, gravedad, fecha, relato de los hechos) y consulta únicamente los partes que él mismo ha registrado.
2. **Coordinación**: ve la bandeja completa de incidencias del centro, las toma, añade entradas de seguimiento cronológicas y las cierra registrando la resolución adoptada y la comunicación a la familia. Es el único rol que cierra.
3. **Dirección**: consulta un resumen mensual agregado (volumen, abiertas, tiempo medio de cierre, distribución por tipo y por aula) sin acceso al nombre del alumno ni al relato de los hechos — el propio prototipo ya oculta esos campos en la vista de dirección.

Reemplaza el Excel compartido entre docentes y los correos a coordinación, que hoy no dejan trazabilidad de quién actuó, cuándo se cerró la incidencia ni cuánto tardó, y exponen datos de alumnos (nombre, relato de conducta) en hojas compartidas y buzones de correo sin control de acceso.

## Para quién

- **Docente**: personal docente del centro que imparte clase y puede presenciar o recibir aviso de una incidencia. Solo ve lo que él mismo registra — no ve partes de otros docentes.
- **Coordinación**: perfil de convivencia/jefatura de estudios del centro. Ve y gestiona todas las incidencias, sin importar quién las registró.
- **Dirección**: dirección del centro. Solo lectura, solo del resumen agregado del mes — nunca del detalle identificativo de un alumno.

Los tres son personal del centro con cuenta en la plataforma (no hay flujo público ni de alumno/familia: ni el alumno ni su familia acceden al sistema).

## Flujo funcional (Docente)

1. Accede a "Registrar una incidencia": formulario con alumno afectado, aula/grupo, tipo (catálogo cerrado: convivencia, retraso reiterado, material dañado, ausencia sin justificar, uso indebido de dispositivos, otro), gravedad (baja/media/alta), fecha del hecho y relato objetivo de lo ocurrido.
2. El prototipo ya avisa en el propio formulario que es un dato personal con acceso restringido — se mantiene ese aviso.
3. Al registrar, la incidencia queda en estado "Abierta" y visible para coordinación; el docente ve su propia lista con estado en tiempo real (abierta / en curso / cerrada) y puede abrir el detalle para leer el seguimiento y, si está cerrada, la resolución.

## Flujo funcional (Coordinación)

1. Bandeja con KPIs (sin tomar, en curso, gravedad alta, cerradas) y filtros por estado/aula.
2. Abre el detalle de cualquier incidencia: ve alumno, aula, gravedad, fecha, relato completo y la línea de tiempo de seguimiento.
3. Acciones: "Tomar el caso" (pasa de abierta a en curso y dispara la primera entrada de seguimiento), "Guardar seguimiento" (añade una entrada cronológica libre) y "Cerrar incidencia" (exige una resolución no vacía; registra fecha de cierre y bloquea nuevas acciones).

## Flujo funcional (Dirección)

1. Resumen del mes en curso: incidencias totales, abiertas hoy, días medios hasta el cierre, gravedad alta.
2. Dos distribuciones (por tipo, por aula) y una tabla de detalle **sin alumno ni relato** — solo referencia, aula, tipo, gravedad, fecha, estado y días hasta cierre.

## Qué NO incluye este MVP (fuera de alcance, salvo que se pida explícitamente)

- Notificación automática a la familia (hoy es una acción manual que coordinación registra como texto libre en el seguimiento/resolución, igual que en el prototipo — no hay envío de email/SMS real).
- Adjuntar archivos a una incidencia (fotos del material dañado, partes firmados, etc.) — el prototipo no lo contempla.
- Exportación de datos (Excel/CSV) para ningún rol — el prototipo no la incluye (a diferencia de `orientador-ia`, que sí trae `exportTrainingExcel`).
- Edición o borrado de una incidencia ya registrada por el docente, y edición de una incidencia ya cerrada por coordinación — el prototipo no ofrece ninguna de las dos.
- Gestión de catálogos desde la UI (altas/bajas de aulas o tipos de incidencia) — en el prototipo son constantes fijas en el código; ver "Preguntas abiertas".
- Cualquier acceso de alumno o familia al sistema (portal, notificación con enlace, etc.).
- Multi-centro: el prototipo trae aulas y datos de un único centro; si Awakelab necesita el mismo módulo para varios centros de FP, es una decisión de arquitectura posterior (mismo criterio que `orientador-ia` con multi-cliente), no de este MVP.

## Preguntas abiertas para el gate (necesitan respuesta de quien encarga antes de generar)

1. **¿A qué centro/organización pertenece este módulo?** El manifest no lo indica. Si es un centro externo a Awakelab (como Aspasia en `orientador-ia`), aplica el mismo patrón de "cliente externo con rol acotado"; si es un centro propio del grupo, cambia solo quién administra las altas de usuarios, no el diseño. Bloquea la redacción final de roles/nombres en `spec-tecnica.md` (hoy usa nombres genéricos `incidencias_docente` / `incidencias_coordinacion` / `incidencias_direccion`).
2. **¿El alumnado de este centro de FP incluye menores de edad?** Los ciclos de grado medio admiten alumnado desde 16 años. Si hay menores, se refuerza (no cambia) el tratamiento ya previsto como "datos personales": confirmar si aplica alguna política adicional del centro (p. ej. quién más, aparte de coordinación/dirección, tiene potestad legal de acceso).
3. **Catálogo de tipos de incidencia**: el manifest lo describe como "configurable", pero el prototipo lo tiene fijo en el código (6 tipos) sin pantalla de administración. ¿Se mantiene fijo para el MVP (recomendado, más simple) o se necesita ya una pantalla de edición del catálogo (como las "academias" de `orientador-ia`)?
4. **Catálogo de aulas/grupos**: mismo caso — hoy es una lista fija de 6 aulas de ejemplo. ¿Se gestiona desde este módulo, se sincroniza desde Moodle si este centro ya usa `moodle-insights`, o se mantiene fija/editable solo por un admin de plataforma?
5. **Más de un docente/coordinador**: igual que se preguntó en `orientador-ia` para los admins de Aspasia — ¿coordinación es una sola persona o varias que comparten la misma bandeja sin partición? El prototipo asume una sola persona de coordinación logueada a la vez; se recomienda tratarlo igual que en `orientador-ia` (todas comparten la misma bandeja) salvo indicación contraria.

## Flags para el gate (docs/05 — por qué la revisión técnica es obligatoria, no muestreada)

- **Datos personales (RGPD)**: nombre de alumno, aula, relato de conducta, seguimiento y resolución — el manifest ya declara `datos_personales` en las tres entidades principales; el análisis lo confirma y no lo rebaja (potencialmente agravado si hay alumnado menor de edad, pregunta abierta 2).
- **Primer módulo de este tipo**: primer módulo de la plataforma que registra expedientes de conducta/convivencia de alumnos con tres roles de visibilidad distinta sobre la misma incidencia, incluyendo un rol (Dirección) que ve agregados del mismo dato que otros ven en detalle pero sin ningún campo identificativo — patrón de minimización por rol no ejercitado antes (ver `spec-tecnica.md`).
- **Alcance ambiguo**: propiedad del centro/cliente, catálogos "configurables" vs. fijos, y partición de coordinación (preguntas abiertas 1, 3, 4, 5).
- **Sin dependencias externas nuevas**: a diferencia de `orientador-ia`, este módulo no llama a ningún sistema externo (no hay LLM, no hay integración con Moodle en este MVP salvo que la pregunta abierta 4 se resuelva en ese sentido).
