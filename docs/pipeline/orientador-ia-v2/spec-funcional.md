# Spec funcional — `orientador-ia-v2`

> Artefacto del pipeline de Fase 1 (docs/04, paso 2 — ANÁLISIS). Este documento es para aprobación del gerente/solicitante (Leonardo). No contiene detalle técnico — ver `spec-tecnica.md`.

## Origen

Mismo material fuente que el proyecto ya construido `orientador-ia`: la carpeta `/Users/leonardobarreto/projects/orientadorIA` (`index.html` + `app.js` + `orientadorIA.html`, prototipo standalone de Rodrigo Poblete para Grupo Aspasia/Refactika), enviado de nuevo el 2026-07-16 por `leonardo.barreto@awakelab.dev` con la etiqueta "Orientador IA (validación pipeline)".

**No hay manifest ni petición adicional que declare qué cambia respecto al prototipo original.** El análisis trata esta entrada como una resubmisión del mismo prototipo, no como un encargo nuevo.

## Hallazgo principal: esto ya existe (antiduplicación, docs/04)

Antes de proponer cualquier flujo funcional nuevo, este análisis debe reportar lo que exige el paso de antiduplicación (`list_modules`, docs/04): **este prototipo ya fue procesado por el pipeline y está construido y desplegado como el módulo `orientador-ia`.**

Evidencia revisada en el repo:

- Módulo completo en `apps/api/src/modules/orientador-ia/` (intake, análisis con Claude, academias, leads, export) y `apps/web/src/modules/orientador-ia/` (landing pública del candidato, panel admin, extracción de PDF, generación de itinerario).
- Historial de commits que documenta el recorrido completo del pipeline para este mismo prototipo: `[module] orientador-ia: backend inicial (Fase 1, D-024/D-025)`, `[module] Frontend de orientador-ia (paso 0 de D-026, D-027)`, ajuste post-despliegue de roles admin, y rediseño de marca (D-028).
- `docs/pipeline/orientador-ia/spec-funcional.md` y `spec-tecnica.md` ya existen, con gate funcional y gate técnico **APROBADOS** (2026-07-14).
- `docs/STATUS.md` confirma: *"primer caso `orientador-ia` completo end-to-end, backend+frontend"*, dentro de la Fase 1 en curso.
- Schema Prisma dedicado (`schema orientador`: `leads`, `profiles`, `academies`, `exports_log`) ya migrado.

Es decir: el flujo funcional completo que este documento describiría (consentimiento RGPD → historia/CV/LinkedIn → análisis con Claude → perfil y plan recomendado → PDF de itinerario → panel admin de Aspasia con leads y academias) **es exactamente lo que ya hace el módulo desplegado `orientador-ia`.** No hay contenido funcional nuevo que analizar porque la entrada es idéntica a la ya resuelta.

## Qué hace hoy el módulo ya construido (para referencia rápida del gate)

- Candidato (público, sin login) cuenta su historia o sube su CV; el backend llama a Claude (Haiku) y genera un perfil estructurado (sector, justificación, nivel, huecos de formación) — sustituye por completo el keyword-matching decorativo del HTML original.
- El candidato ve su plan por sector y descarga el itinerario en PDF (client-side).
- Admin de Aspasia (rol `orientador_admin`/`admin`) gestiona leads, exporta a Excel y edita el contenido de las 13 academias.
- Límite de 50 análisis por candidato (por email) + rate-limit por IP antes del consentimiento.

Detalle completo, sin repetirlo aquí: `docs/pipeline/orientador-ia/spec-funcional.md`.

## Decisión que corresponde al gate (no es una decisión técnica)

Este análisis no puede decidir por sí solo si "orientador-ia-v2" es:

1. **Una resubmisión accidental o una validación deliberada del pipeline** (la propia etiqueta de la tarea, "validación pipeline", sugiere esto último — probar que el paso de antiduplicación efectivamente detiene un prototipo ya resuelto). En ese caso: **no se genera código, no se crea un módulo nuevo ni una v2 del schema.** El resultado esperado del gate es rechazar este proyecto con motivo "duplicado de `orientador-ia`, ya desplegado".
2. **Un encargo real de cambios** sobre el módulo ya vivo (nuevo cliente, contenido distinto, un flujo adicional, etc.). En ese caso, el mecanismo correcto **no es este pipeline de creación** sino `request_change` (docs/04) sobre el módulo `orientador-ia` existente — que analiza el módulo actual + la petición concreta y genera una mini-spec incremental. Para eso hace falta que Leonardo (u otro solicitante) describa **qué cambia**, no que reenvíe el mismo HTML sin diferencias.

Sin esa aclaración, la única salida funcionalmente correcta de este gate es **rechazar/archivar** este proyecto y no avanzar a generación.

## Para quién (si el gate decidiera igualmente tratarlo como nuevo)

No aplica: sería la misma segmentación ya vigente en `orientador-ia` (candidato público, admin de Aspasia, Awakelab interno sin rol nuevo). Repetirla como si fuera un requisito nuevo sería precisamente la duplicación que este hallazgo busca evitar.

## Qué NO incluye este análisis

- No se ha re-derivado un flujo funcional "desde cero" para esta entrada, porque hacerlo sin señalar la duplicación sería exactamente el fallo que el paso de antiduplicación de docs/04 existe para prevenir.
- No se proponen cambios al módulo `orientador-ia` ya desplegado: no hay una petición concreta de cambio que analizar todavía.

## Gate funcional — pendiente de decisión de Leonardo

Este documento no está aprobado ni rechazado por defecto: **requiere una respuesta explícita** sobre si este envío era una prueba del pipeline (cerrar como duplicado, sin generación) o si oculta un cambio real no declarado (en cuyo caso, reenviar vía `request_change` con el detalle de qué cambia).
