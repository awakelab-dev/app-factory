# Spec técnica — `orientador-ia`

> Artefacto del pipeline de Fase 1 (docs/04, paso 2). Para revisión técnica (docs/05) antes de generación. Depende de las decisiones funcionales aprobadas en `spec-funcional.md`.

## Score de complejidad y por qué el gate es obligatorio

Obligatorio por docs/05 (cumple varios criterios simultáneos, no solo uno):

- Datos personales/RGPD (nombre, email, teléfono, historia/CV completo).
- Dependencia externa nueva (API de Claude): costo variable, latencia, necesidad de límites.
- Primer módulo con superficie **pública no autenticada** (candidato) combinada con **rol acotado a cliente externo** (admin de Aspasia) — patrón no ejercitado antes (`moodle-insights` es 100% interno tras login).
- Complejidad media-alta: ~5 entidades nuevas, integración LLM, generación de PDF server-side (hoy es client-side con jsPDF; a decidir si se mantiene client-side o se mueve a server, ver "Abierto").

No aplica auto-aprobación por muestreo.

## Reutilización del core (docs/02, docs/03, D-011)

- **Auth/RBAC**: se reutiliza el patrón existente sin cambios de core. Nuevo rol `orientador_admin` declarado en el `module.manifest.ts` del módulo (D-011: los manifests son el único lugar donde se declara un rol nuevo; el shell y el guard `RolesGuard` ya lo resuelven sin tocar `packages/auth`). Los usuarios de Aspasia se crean como usuarios de plataforma (seed/admin) con ese único rol — no ven `core-admin` ni otros módulos.
- **Rutas públicas**: el flujo del candidato usa `@Public()` (D-011, ya existe en el core) en los endpoints de intake/perfil — no requiere ningún mecanismo nuevo de auth.
- **Auditoría**: se reutiliza `AuditService` (core) para registrar accesos de `orientador_admin` a leads (dato personal) — mismo patrón que cualquier módulo, sin cambios de core.
- **Patrón de módulo**: mismo patrón D-011/D-022 que `moodle-insights` — carpeta propia en `apps/api/src/modules/orientador-ia/`, `apps/web/src/modules/orientador-ia/`, schema PG propio `orientador` (multiSchema, junto a `core`/`moodle`).

## Modelo de datos (schema PG `orientador`)

```
orientador.leads
  id, created_at
  full_name, email, phone (nullable)
  consent_given (bool), consent_marketing (bool), consent_at (timestamptz)
  raw_input_type (enum: story | linkedin_url | cv_pdf)
  raw_input_text (text, hasta ~2000 chars, igual que el prototipo original)
  declared_sector (nullable), declared_level (nullable)

orientador.profiles
  id, lead_id (FK → leads)
  recommended_sector, rationale (text, salida del LLM)
  estimated_level, skill_gaps (jsonb)
  llm_model_used, llm_tokens_used, created_at
  # jsonb para skill_gaps: es la parte genuinamente variable del análisis (docs/02 lo permite explícitamente para este caso)

orientador.academies        # contenido editable de las 13 "academias"/ofertas (hoy hardcodeado en app.js)
  id, sector, title, description, price, level, purchase_url, active

orientador.exports_log      # trazabilidad de exportaciones (RGPD, quién exportó qué y cuándo)
  id, admin_user_id, exported_at, lead_count
```

Todas las tablas de `leads`/`profiles` quedan protegidas por RBAC de endpoint (rol `orientador_admin`); no se requiere RLS de Postgres (docs/05 la reserva para "confidencial" — este dato es "personal", el control es a nivel de aplicación + auditoría, igual de estricto pero sin la capa extra de RLS que sí exige `core` u otros módulos con multi-rol sobre la misma fila).

## Endpoints (NestJS, `apps/api/src/modules/orientador-ia/`)

| Método/ruta | Acceso | Función |
|---|---|---|
| `POST /api/orientador-ia/intake` | `@Public()` | Recibe consentimiento + historia/URL/CV, crea `lead`, dispara análisis (síncrono si el LLM responde rápido; si no, mismo patrón asíncrono de `moodle-insights` D-022 con polling) |
| `GET /api/orientador-ia/intake/:id` | `@Public()` (con token de sesión del propio candidato, no JWT de plataforma) | El candidato consulta su propio perfil generado para ver el resultado |
| `GET /api/orientador-ia/academies` | `@Public()` | Contenido de las academias para renderizar el plan |
| `GET /api/orientador-ia/leads` | `@Roles('orientador_admin')` | Panel admin: lista de leads + perfiles |
| `GET /api/orientador-ia/leads/export` | `@Roles('orientador_admin')` | Exporta a Excel (reusa lógica de `exportTrainingExcel` del prototipo, adaptada a backend) |
| `PUT /api/orientador-ia/academies/:id` | `@Roles('orientador_admin')` | Edita contenido de una academia |

## Integración con Claude API — diseño y control de costo

- **Una llamada estructurada por candidato**, no chat multi-turno: el backend arma un prompt con la historia/CV/LinkedIn ya extraído + sector/nivel declarado, y le pide a Claude una salida estructurada (JSON: sector recomendado, justificación breve, nivel estimado, 2-3 huecos de formación). Esto acota el costo a ~1 llamada por candidato en vez de una conversación abierta.
- **Modelo confirmado (gate, 2026-07-14): Haiku** — la tarea es clasificación + resumen estructurado sobre texto corto (≤2000 caracteres), no razonamiento complejo.
- **Límite confirmado (gate, 2026-07-14): hasta 50 ejecuciones por candidato.** Al no haber login, "candidato" se identifica por `email` (capturado en el consentimiento, paso previo a la llamada al LLM) — contador en `orientador.leads` (nueva columna `analysis_count`), incrementado en cada `POST /intake` que dispare una llamada real a Claude; al llegar a 50 el endpoint responde 429 con mensaje explicativo. Antes de tener el email (abuso anónimo previo al consentimiento) se aplica además un rate-limit básico por IP a nivel de Nginx/Nest (p. ej. 10 requests/min) como cinturón de seguridad, no como el control de negocio principal.
- Tope de tokens de salida acotado (respuesta JSON estructurada corta) y timeout con reintento único.
- **Extracción de CV/LinkedIn**: el prototipo ya extrae texto del PDF client-side (`pdf.js`) — se reutiliza esa librería en el frontend (sube el texto ya extraído, no el PDF binario, minimiza superficie de datos que toca el backend). La URL de LinkedIn **no se scrapea** (no estaba implementado y añadir scraping de LinkedIn tiene sus propios problemas de ToS) — queda como campo informativo que el candidato puede pegar, pero el análisis se basa en el texto libre/CV, no en un fetch a LinkedIn.
- **Secreto**: `ANTHROPIC_API_KEY` como variable de entorno del backend (mismo patrón que `MOODLE_TOKEN`, D-022) — nunca en el cliente (corrige el hallazgo del prototipo original, que tenía credenciales de admin hardcodeadas en el JS servido al navegador).

## PDF del itinerario

- Prototipo actual: `jsPDF` client-side. **Se mantiene client-side** para el MVP (no hay dato sensible adicional en el PDF que no esté ya en el perfil que el candidato ya puede ver) — evita mover una dependencia de generación de PDF al backend sin necesidad. Si más adelante se requiere versión firmada/oficial del itinerario, se reevalúa.

## Frontend (`apps/web/src/modules/orientador-ia/`)

- Reutiliza `packages/ui` (shadcn/ui + tokens Awakelab) en vez de Tailwind CDN + config de marca Refactika del prototipo — implica re-implementar las pantallas (`Landing`, `ConsentGate`, `Profile`, `Plan`, `AdminPanel`, etc.) sobre los componentes de plataforma, no copiar el HTML/JS del prototipo tal cual.
- El flujo del candidato es la única parte de la plataforma con rutas realmente públicas (sin JWT) — el manifest debe declarar explícitamente estas rutas como públicas para que el shell no intente forzar login ahí (hoy el shell asume RBAC/login para construir menú y rutas, D-011; hay que confirmar que el patrón soporta una "app pública" embebida sin romper esa asunción — **primer caso, revisar en el gate técnico**).
- Panel admin: sigue el patrón estándar de plataforma (menú por manifest, solo visible para `orientador_admin`).

## Gate técnico — APROBADO (2026-07-14)

Resuelto por Leonardo: modelo Haiku, límite de 50 ejecuciones/candidato (ver arriba), contenido de itinerario/academias se mantiene tal cual, admins de Aspasia comparten vista de leads sin partición. Spec técnica aprobada para pasar a generación.

**Único punto que sigue siendo de implementación, no de negocio** (se resuelve durante la generación, no bloquea el arranque): confirmar en la práctica que el shell (`Layout.tsx`/router) soporta una sección pública sin romper la asunción de "todo detrás de login" que tiene hoy (D-011); si no la soporta tal cual, es un ajuste pequeño y genérico al core (rutas públicas por manifest), reutilizable por cualquier módulo futuro con landing pública — se documenta como decisión nueva si termina tocando el core.
