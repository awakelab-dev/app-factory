# 08 — Auth del conector Cowork: evaluación OAuth vs Enterprise-managed auth y plan

> Nota de diseño (decisión-soporte). Origen: D-039 — la prueba real del plugin `awk-prototipo` en Cowork destapó que la auth interina por PAT-en-header es incompatible con el conector de Cowork. Objetivo de este doc: elegir el mecanismo de auth del conector de **gerentes** y dejar el plan del incremento. Alcance fijado por Leonardo (2026-07-20): **solo desbloquear el conector**, reutilizando `factory_actors`, sin tocar el `dev-login` de la Plataforma todavía. IdP corporativo disponible: **Microsoft 365 / Entra ID**.

## 1. El problema, en una frase

El conector de Cowork **conecta desde la nube de Anthropic, no desde el Mac** (doc oficial; confirmado en vivo en D-039). Por eso el `Authorization: Bearer ${AWKFACTORY_TOKEN}` del `.mcp.json`, expandido desde una variable local, no puede funcionar ahí: la nube no ve el entorno de la máquina. El modelo de auth de un conector remoto en Cowork es **OAuth** (flujo en el navegador; "Claude nunca ve la contraseña"), y en org Team/Enterprise el conector lo **habilita un Owner** a nivel organización. El PAT-en-header sigue siendo válido para técnicos vía Claude Code CLI (que sí conecta desde local).

## 2. Enterprise-managed auth: descartado (por ahora)

`Enterprise-managed auth` ("autorizar el conector una vez para toda la org, el equipo hereda acceso en el primer login") **no nos sirve hoy**:

- **Presupone un IdP ya integrado** con Claude — soporta **Okta** al lanzamiento (más "coming soon"). Provisiona acceso "a través del identity provider de la organización". Es decir, asume resuelto justo lo que no tenemos integrado con Claude.
- Está en **beta con lista de espera** (waitlist para clientes y para MCP providers).
- El MCP tendría que implementar la extensión **Enterprise-Managed Authorization** del spec MCP.
- La lista de conectores soportados hoy es cerrada (Asana, Atlassian, Canva, Figma, Granola, Linear, Supabase; Slack pronto).

Conclusión: reevaluar en el futuro (si Awakelab integra Entra con Claude vía EMA cuando Entra sea soportado), pero **no es el camino para desbloquear ahora**.

## 3. OAuth: lo que exige el spec MCP a `apps/factory`

Por el spec de autorización de MCP (basado en OAuth 2.1), con `apps/factory` como **resource server**:

1. **Protected Resource Metadata (RFC 9728)**: exponer `/.well-known/oauth-protected-resource` con el campo `authorization_servers` (≥1 AS).
2. **401 + `WWW-Authenticate`**: cuando llega una request sin token válido, responder 401 con la cabecera `WWW-Authenticate` apuntando a la URL del resource metadata. (Hoy el guard ya devuelve 401; falta la cabecera.)
3. El **Authorization Server** (puede vivir en el mismo Nest o ser externo) debe publicar **Authorization Server Metadata (RFC 8414)** en `/.well-known/oauth-authorization-server`.
4. Flujo **Authorization Code + PKCE** (OAuth 2.1). Cliente público → **refresh tokens rotativos**, access tokens de vida corta.
5. **Resource Indicators (RFC 8707)**: el cliente (Claude) manda `resource=<URL canónica del MCP>`; el resource server **DEBE validar que el token fue emitido para él** (audiencia). Prohibido el token passthrough.
6. **Dynamic Client Registration (RFC 7591)** es *SHOULD*, no *MUST*. Como el alta de custom connector en Claude permite **pre-registrar Client ID/Secret** (Advanced settings), **evitamos DCR**.
7. Todo por **HTTPS**; redirect URIs con match exacto contra los pre-registrados.

Punto pivote: OAuth **autentica a una persona en el navegador**. Awakelab tiene esa identidad en **Entra ID**. Así que el AS de awkfactory debe, de un modo u otro, apoyarse en Entra para autenticar. De ahí las dos arquitecturas.

## 4. Dos arquitecturas

### Opción A — Entra como Authorization Server; `apps/factory` solo Resource Server

`awkfactory` no emite tokens: su Protected Resource Metadata apunta `authorization_servers` a **Entra** (`https://login.microsoftonline.com/<tenant>/v2.0`). Claude hace el flujo OAuth **directamente contra Entra**; Entra emite el access token (JWT RS256) con audiencia = la API de awkfactory. `awkfactory` **solo valida** ese JWT (firma vía JWKS de Entra, `aud`, `tid`, expiración) y mapea el `email`/`oid` del token a una fila activa de `factory_actors` para el rol y el scope.

- **Trabajo de código**: mínimo. Endpoint de PRM + una rama nueva en `FactoryAuthGuard` que valide JWT de Entra (hoy ya valida JWT de plataforma y PAT; sería la tercera rama, mismo patrón `→ request.actor {email, rol}`). Sin AS que construir ni operar.
- **Trabajo de configuración (Owner/admin)**: en Entra, **dos app registrations** — una que **expone la API** (Application ID URI = audiencia, un scope p. ej. `mcp.access`) y otra (o la de "Claude") como **cliente** con el **redirect URI de Anthropic** pre-registrado; en Claude, el Owner añade el custom connector con la URL del MCP + el Client ID/Secret de Entra.
- **Riesgo principal (a validar en un spike)**: compatibilidad fina Claude↔Entra — que Entra respete el `resource`/audiencia como el spec MCP espera (Entra tradicionalmente fija audiencia vía `scope=api://<app-id>/.default`, no vía `resource`), el registro exacto del redirect URI de Anthropic, y el manejo de metadata/consentimiento. Es el mismo tipo de fricción que ya nos mordió en D-039, ahora del lado Entra.
- **Revocación / control**: Entra controla el ciclo de vida del token (expiración, revocación al desactivar la cuenta en Entra). La **autorización de negocio** (quién es gerente, sobre qué proyectos) la sigue mandando `factory_actors`: un usuario del tenant sin fila activa → denegado por el guard aunque Entra emita token.

### Opción B — `apps/factory` como Authorization Server + Resource Server, federando la autenticación a Entra

`awkfactory` es su propio AS (con una librería OIDC vetada, no a mano): publica PRM+ASM, hace Authorization Code + PKCE con Claude, y **para autenticar a la persona federa a Entra por OIDC** (Entra como IdP "upstream"). Tras el login en Entra, mapea el email a `factory_actors`, y **emite su propio token** con audiencia = la URL del MCP, vida corta + refresh rotativo.

- **Trabajo de código**: mayor — montar el AS (autorización, token, metadata, federación OIDC a Entra, almacenamiento de códigos/tokens/refresh). Usar librería (p. ej. un OpenID Provider de Node) para no hand-rollear la seguridad. Más superficie que mantener.
- **Trabajo de configuración**: **una** app registration en Entra (awkfactory como cliente OIDC de Entra, redirect = el `/callback` de nuestro AS — bajo NUESTRO control, no el de Anthropic). En Claude, el Owner añade el custom connector con la URL + client id/secret que **nosotros** definimos.
- **Ventaja**: hacia Claude el AS es **spec-limpio y predecible** (lo controlamos nosotros), aislando las rarezas de Entra; control total de audiencia/vida/refresh; `factory_actors` como fuente de autorización natural; y es la **semilla del SSO de la Plataforma** el día que se retome (aunque hoy no lo toquemos).
- **Contra**: es, en esencia, empezar a construir el AS/IdP que docs/05 difería — más de lo que pide "solo desbloquear".

### Comparación

| Criterio | A — Entra como AS | B — factory como AS (federa a Entra) |
|---|---|---|
| Código nuevo en factory | Bajo (PRM + validar JWT) | Alto (AS con librería + federación) |
| Config en Entra | 2 app regs (API + cliente Claude) | 1 app reg (factory cliente de Entra) |
| Redirect URI a registrar | El de **Anthropic** (hay que averiguarlo) | El **nuestro** (bajo control) |
| Predecibilidad hacia Claude | Depende de compat Entra↔MCP (riesgo) | Alta (AS propio spec-limpio) |
| Control de token (aud/vida/refresh) | De Entra | Nuestro |
| Operación/mantenimiento | Casi nulo | AS a mantener |
| Encaja "solo desbloquear" | Sí | Es más de lo pedido |
| Sirve de base al SSO de Plataforma | No directamente | Sí |
| Autorización de negocio | `factory_actors` (igual en ambas) | `factory_actors` |

## 5. Recomendación

**Empezar por la Opción A (Entra como AS, factory como resource server), con un spike de compatibilidad como gate; dejar la Opción B como fallback documentado.**

Razones, con el criterio del proyecto (mínimo, sensible a costo, un solo dev): A es el menor cambio de código, no añade un AS que operar, y aprovecha que Entra ya es el IdP real de Awakelab. El único gran riesgo (compat Claude↔Entra en `resource`/audiencia y redirect URI) es **barato de verificar** con un spike acotado **antes** de invertir en nada. Si el spike falla o resulta frágil, caemos a B, que es robusto hacia Claude a cambio de construir el AS — y ese trabajo no se pierde: es el arranque del SSO que la Plataforma necesitará igual. En ambos casos **la autorización de negocio no se mueve de `factory_actors`**: Entra autentica, la Fábrica decide quién es gerente y qué ve.

Nota sobre el plugin: con OAuth, **el conector deja de vivir en el `.mcp.json` del plugin** (ese patrón de header estático es solo para el CLI). Para gerentes, el conector se añade como **custom connector a nivel org por el Owner** (solo URL; el resto se descubre por PRM/OAuth), y el **plugin queda aportando únicamente la skill** `awk-prototipo`. Hay que ajustar D-038 en esa dirección.

## 6. Plan del incremento (por fases)

**Fase 0 — Spike de compatibilidad (gate; ~medio día, sin escribir el módulo definitivo)**
- En Entra: crear la app reg de la API (Application ID URI + scope) y la app reg cliente para Claude con el **redirect URI de Anthropic** (obtenerlo de la pantalla de alta de custom connector / doc oficial).
- En staging: exponer un `/.well-known/oauth-protected-resource` mínimo apuntando a Entra y validar un JWT de Entra en un endpoint de prueba.
- Owner añade el custom connector en Organization settings → Connectors → Add → Custom → Web (URL de staging del MCP) + Client ID/Secret de Entra.
- Un gerente pulsa Connect en Cowork y hace login con su cuenta Entra. **Éxito = el conector queda connected + 5 tools y una tool responde**. **Fallo/fricción = pasar a Opción B.**

**Fase 1 — Resource server en `apps/factory` (Opción A)**
- Endpoint PRM (`/factory-api/.well-known/oauth-protected-resource`) y 401 con `WWW-Authenticate`.
- Rama nueva en `FactoryAuthGuard`: validar JWT de Entra (JWKS cacheado, `aud` = nuestra API, `tid` = tenant, `exp`), extraer `email`, mapear a `factory_actors` (fila activa + rol) → `request.actor`. Un email del tenant sin fila activa: 403. Tests de la nueva rama (token válido/inválido/audiencia mala/email no autorizado).
- El PAT-en-header y el JWT de plataforma **se mantienen** (técnicos por CLI, admin por /factory). Auth multi-esquema.

**Fase 2 — Alta y prueba end-to-end**
- Owner añade el connector de **producción** (create-actor sigue existiendo solo para PATs de CLI; los gerentes ya no necesitan PAT).
- Prototipar algo pequeño de punta a punta desde Cowork con la skill → submission `received` en `/factory`.
- Documentar en el runbook la vía OAuth para gerentes (reemplaza los pasos de token local, que quedan marcados como solo-CLI).

**Fase 3 — Limpieza / decisión de futuro**
- Decidir si `factory_actors` para gerentes se sigue rellenando a mano (create-actor sin token, solo email+rol para la allowlist) o si el rol se deriva de grupos de Entra (más adelante).
- Anotar la ruta a Enterprise-managed auth / SSO de Plataforma como trabajo futuro (Opción B revivida o EMA cuando Entra sea soportado).

## 7. Riesgos y validaciones

- **Compat `resource`/audiencia en Entra** (Opción A): el mayor. Lo resuelve el spike de Fase 0. Si Entra no fija la audiencia como Claude espera, Opción B.
- **Redirect URI de Anthropic**: hay que obtener el valor exacto para registrarlo en Entra (match exacto o el flujo falla).
- **Alcance de red**: el MCP debe ser alcanzable desde las IPs de Anthropic (staging/prod ya son públicos por HTTPS; si algún día se cierra por firewall, allowlistear las IPs de Anthropic).
- **Revocación**: en A, desactivar en Entra corta el acceso; además `factory_actors` permite denegar sin tocar Entra. Definir cuál es la palanca operativa.
- **Vida del token**: access token corto + refresh rotativo (el cliente de Claude gestiona el refresh). Confirmar tiempos por defecto de Entra.

## 8. Qué NO hace este incremento

- **No toca el `dev-login` de la Plataforma** ni introduce SSO para apps/api/apps/web (alcance = solo el conector, decisión de Leonardo).
- **No elimina el PAT**: sigue como auth de técnicos por Claude Code CLI (donde la expansión local sí funciona).
- **No adopta Enterprise-managed auth** (descartado en §2; reevaluable a futuro).
