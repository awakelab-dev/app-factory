# Spec funcional — `orientador-ia`

> Artefacto del pipeline de Fase 1 (docs/04, paso 2 — ANÁLISIS). Primer caso real que pasa por el pipeline con spec intermedia (D-024). Este documento es para aprobación del gerente/solicitante (Leonardo, en el doble rol de D-021). No contiene detalle técnico — ver `spec-tecnica.md`.

## Origen

Prototipo `orientadorIA` (carpeta `/Users/leonardobarreto/projects/orientadorIA`, generado en una sesión de Cowork ajena, aparentemente por Rodrigo Poblete para Grupo Aspasia/Refactika, sin build system: `index.html` + `app.js` + `orientadorIA.html` standalone, sin backend). Documento de referencia dentro del propio prototipo: `DEPLOY.md`, que ya diagnostica sus propios gaps de producción.

## Qué hace hoy (estado del prototipo)

Página informativa sobre el mercado laboral español con un flujo de "orientación": el visitante cuenta su historia profesional (texto libre, URL de LinkedIn o CV en PDF), el sistema **hoy** infiere su sector por coincidencia de palabras clave (no hay IA real: cero llamadas a un LLM) y muestra contenido estático pre-escrito por sector (13 sectores), con una animación de "Analizando tu perfil con IA…" puramente decorativa. Genera un PDF de itinerario descargable y captura el lead (nombre, email, teléfono, consentimiento RGPD) en el `localStorage` del navegador del propio visitante — sin backend, sin centralización. Incluye un panel de administración con credenciales hardcodeadas en el JS del cliente.

## Decisiones ya tomadas por Leonardo (gate funcional, primera vuelta)

1. **IA real**: el MVP incorpora una llamada real a la API de Claude para analizar la historia/CV del usuario y generar el perfil y la recomendación — sustituye el motor de keyword-matching actual como fuente de la recomendación (ver `spec-tecnica.md` para el diseño concreto de esa llamada y el control de costo).
2. **Marca**: se rebrandea a identidad Awakelab 2026 (Poppins, paleta cian/azul, logo) — se abandona la identidad visual "Refactika" del prototipo.
3. **Propietario/uso**: es un **encargo de Awakelab para Grupo Aspasia/Refactika** (Awakelab construye y aloja; el cliente final del panel admin es personal de Aspasia, no de Awakelab). No es multi-tenant (docs/06, Fase 4 aún no aplica): el aislamiento se resuelve con un rol de plataforma acotado a este módulo (ver "Roles"), no con una arquitectura separada.

## Para quién

- **Candidato/visitante** (público, sin login): cualquier persona que llega a la página y hace el flujo de orientación. No tiene cuenta en la plataforma.
- **Admin de Aspasia** (con login en la plataforma Awakelab, rol acotado a este módulo): ve leads capturados, gestiona el contenido de las "academias"/ofertas formativas, exporta datos.
- **Awakelab (interno)**: sin rol especial nuevo; los admins de plataforma ya tienen visibilidad de auditoría general (core).

## Flujo funcional (candidato)

1. Landing informativo sobre el mercado laboral (contenido por sector/región — hoy ilustrativo, ver "Flags" sobre veracidad de datos).
2. Pantalla de consentimiento RGPD (nombre, email, teléfono opcional, checkbox de consentimiento y de marketing) — se mantiene, redactada correctamente en el original.
3. El candidato cuenta su historia (texto libre), o pega su URL de LinkedIn, o sube su CV en PDF.
4. **Nuevo**: esa información se envía al backend, que llama a Claude para producir un perfil estructurado (sector recomendado + justificación, nivel estimado, huecos de formación) — reemplaza la animación decorativa actual, que hoy no analiza nada.
5. El candidato ve su plan/itinerario recomendado (contenido por sector, igual que hoy, pero ahora seleccionado por el análisis real en vez de por keyword-matching) y puede descargar el PDF del itinerario.
6. El lead (datos de contacto + perfil generado) queda guardado en la plataforma (Postgres), no en el navegador del candidato.

## Flujo funcional (admin de Aspasia)

- Login en la plataforma Awakelab (mismo mecanismo que cualquier usuario, JWT dev-login hoy / IdP mañana, D-011), con un rol que solo le da acceso al módulo `orientador-ia` (no ve otros módulos de la plataforma).
- Panel de leads: lista de candidatos, su perfil generado, datos de contacto, filtros.
- Gestión de las "academias"/ofertas formativas: contenido editable (hoy hardcodeado en el JS del prototipo).
- Exportación de leads (Excel) — funcionalidad que ya existe en el prototipo (`exportTrainingExcel`), se conserva.

## Qué NO incluye este MVP (fuera de alcance, a menos que se pida explícitamente)

- Multi-instancia/multi-cliente (si Awakelab vende este mismo módulo a otro cliente además de Aspasia, eso es una decisión de arquitectura posterior, no de este MVP).
- Datos reales de mercado laboral (SEPE/INE/LinkedIn Economic Graph): el contenido informativo de mercado sigue siendo ilustrativo por ahora — integrarlo con una fuente real es una extensión futura, no bloqueante para el MVP.
- Chat conversacional multi-turno con el LLM: el análisis es una llamada (o pocas) estructurada sobre lo que el candidato ya proporcionó, no una conversación abierta ida y vuelta (ver justificación de costo/alcance en `spec-tecnica.md`).
- Reconocimiento de voz (Web Speech API del navegador en el prototipo original): se mantiene como mejora de UX opcional, no crítica para el MVP.

## Flags para el gate (docs/05 — por qué la revisión técnica es obligatoria, no muestreada)

- **Datos personales (RGPD)**: nombre, email, teléfono, historia profesional/CV completo de cada candidato. Clasificación: datos personales — requiere RBAC + auditoría de acceso, nunca "público" pese a que el flujo de captura es público.
- **Primer módulo de este tipo/cliente**: primer módulo con un flujo público no autenticado y con un cliente externo (Aspasia) como usuario del panel admin — calibración necesaria.
- **Dependencia externa nueva**: llamada a la API de Claude (costo variable por uso, latencia, necesidad de límites/budget — ver spec técnica).
- **Migración/nuevo patrón de RBAC**: primer caso de un rol de plataforma acotado a un cliente externo en vez de personal interno de Awakelab — vale la pena que el revisor confirme que el patrón de manifest (D-011) cubre esto sin cambios al core.

## Gate funcional — APROBADO (2026-07-14)

Respuestas de Leonardo a los pendientes del primer borrador:

- **Contenido del itinerario/academias**: se mantiene tal cual (contenido comercial de Refactika, incluidos precios y links de compra actuales) — sin revisión adicional antes de producción.
- **Admins de Aspasia**: habrá más de un admin. No se pidió aislamiento entre ellos → todos los admins con rol `orientador_admin` ven el mismo panel de leads (sin partición por admin individual); si más adelante Aspasia pide que cada admin vea solo sus propios leads asignados, es una extensión posterior, no bloqueante para el MVP.
- **Límite de uso de la IA**: hasta **50 ejecuciones del orientador por usuario/candidato** — es un tope anti-abuso (uso esperado normal: 1 vez por persona), no un presupuesto de uso recurrente. Ver `spec-tecnica.md` para cómo se identifica "usuario" en un flujo sin login.
- **Modelo de Claude**: Haiku.

Con esto, la spec funcional queda **aprobada** para pasar a generación.
