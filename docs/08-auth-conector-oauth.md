# 08 — Auth del conector Cowork: OAuth con Authorization Server propio (usuario/contraseña)

> Nota de diseño (decisión-soporte). Origen: D-039 (la auth por PAT-en-header es incompatible con el conector de Cowork) → D-040 (evaluación OAuth, recomendaba Entra como AS con spike) → **D-041 (2026-07-21): la organización decide NO usar Entra ID para autenticación**. Vía vigente: **AS propio en `apps/factory` con login clásico usuario/contraseña** (A2F después). La versión anterior de este doc (evaluación Entra A vs B) queda superada; su runbook `docs/runbooks/spike-oauth-entra.md` está OBSOLETO.

## 1. El problema y la restricción dura

El conector de Cowork **conecta desde la nube de Anthropic, no desde el Mac** (D-039), y el alta de un custom connector en una org gestionada **exige OAuth** (Client ID/Secret + flujo en navegador). De ahí dos consecuencias que la decisión de la org NO cambia:

1. **Usuario/contraseña no puede ir "en el conector"**: no existe ese campo. El usuario/contraseña vive en el **formulario de login de NUESTRO Authorization Server**, dentro del flujo OAuth que el conector dispara en el navegador ("Claude nunca ve la contraseña" — la ve nuestro AS).
2. `apps/factory` debe cumplir el spec de autorización MCP igualmente (ver §2).

Lo que SÍ cambia con D-041: **quién autentica**. Sin Entra, la única arquitectura posible es la que la versión anterior llamaba **Opción B, simplificada**: `apps/factory` como **Authorization Server + Resource Server**, sin federación a ningún IdP — autentica él mismo contra credenciales locales. La disyuntiva A/B (y su spike de compatibilidad con Entra) desaparece: ya no hay nada que decidir por spike; la prueba end-to-end con el conector pasa a ser **gate de validación de la implementación**, no de arquitectura.

## 2. Lo que exige el spec MCP a `apps/factory` (sin cambios)

Por el spec de autorización de MCP (OAuth 2.1):

1. **Protected Resource Metadata (RFC 9728)**: `/.well-known/oauth-protected-resource` con `authorization_servers` (ahora: nuestro propio AS).
2. **401 + `WWW-Authenticate`** apuntando a la URL del resource metadata cuando llega una request sin token válido.
3. El AS publica **Authorization Server Metadata (RFC 8414)** / openid-configuration.
4. **Authorization Code + PKCE (S256)**; cliente público → **refresh tokens rotativos**, access tokens de vida corta.
5. **Resource Indicators (RFC 8707)**: Claude manda `resource=<URL canónica del MCP>`; el RS **valida la audiencia** del token. Prohibido token passthrough.
6. **Sin DCR**: el alta del custom connector permite pre-registrar Client ID/Secret (Advanced settings) — y ahora los definimos **nosotros** en el AS.
7. Todo por **HTTPS**; redirect URI con match exacto: `https://claude.ai/api/mcp/auth_callback` (superficies hosted, incl. Cowork — dato confirmado en doc oficial de Anthropic).

## 3. Arquitectura

`apps/factory` = AS + RS, todo dentro del contenedor/prefijo existentes (cero infra nueva):

- **AS con librería OIDC vetada, nunca a mano.** Candidata: `node-oidc-provider` (panva; OpenID-certified, el estándar de facto en Node). Verificar al implementar: Resource Indicators (RFC 8707), rotación de refresh tokens, PKCE obligatorio, y dónde publica su discovery. Si no encaja, evaluar alternativa antes de escribir una línea de flujo OAuth propio.
- **Credenciales en `factory_actors` + `passwordHash`** (argon2id; migración aditiva). Decisión de Leonardo 2026-07-21: alcance mínimo fiel a este doc — no se toca `core.users` ni el `dev-login` de la Plataforma. El CLI gana `set-password` (y/o `create-actor --with-password`); el hash se guarda, la contraseña nunca. `factory_actors` sigue siendo **la fuente de autorización**: sin fila activa no hay login, y el rol/scope de negocio lo siguen decidiendo los servicios.
- **Cliente `claude` pre-registrado** en el AS: Client ID/Secret que definimos nosotros (secret con hash en BD, se muestra una vez — mismo criterio que los PATs), redirect URI exacto `https://claude.ai/api/mcp/auth_callback`.
- **Tokens propios**: access token JWT firmado por el AS (JWKS propio), `aud` = URL canónica del MCP (p. ej. `https://staging.apps.awakelab.world/factory-api/mcp`), vida corta; refresh rotativo (Claude gestiona el refresh; pide `offline_access` si el AS lo anuncia).
- **Guard**: tercera rama en `FactoryAuthGuard` — valida el JWT del AS propio (firma, `iss`, `aud`, `exp`) y mapea `email` → fila activa de `factory_actors` → `request.actor {email, rol}`. **El PAT (técnicos por CLI) y el JWT de plataforma (admin por `/factory`) se mantienen intactos.** Auth multi-esquema.
- **Persistencia del AS**: tablas `oauth_*` (códigos, sesiones/grants, refresh) en la BD de factory vía adapter Prisma. Migración aditiva.
- **A2F (TOTP) después**, como fase propia sobre el login del AS — la decisión org lo contempla "posteriormente".

Ventajas ya argumentadas en la versión anterior para la Opción B y que siguen vigentes: hacia Claude el AS es **spec-limpio y predecible** (lo controlamos); control total de audiencia/vida/refresh; y es la **semilla del SSO de la Plataforma** (docs/03: la línea "Entra ID u Keycloak" queda sustituida por esta pieza mientras la org no adopte IdP). El costo también sigue vigente: **un AS que construir y operar** — asumido por D-041, ya no hay alternativa más corta.

## 4. Plan del incremento (por fases)

**Fase 1 — AS + RS en `apps/factory`** (runbook: `docs/runbooks/oauth-conector-as-propio.md`)
- Migración aditiva: `passwordHash` en `factory_actors` + tablas `oauth_*`; CLI `set-password`.
- AS (librería) montado bajo `/factory-api/oauth/*` con formulario de login usuario/contraseña; cliente `claude` sembrado.
- PRM + 401 `WWW-Authenticate` + tercera rama del guard.
- Nginx: locations `/.well-known/*` en el host → contenedor factory (RFC 8414/9728 ponen el `.well-known` **en la raíz del host** cuando el issuer/resource llevan path — ver runbook; editar el `.conf` a mano, nunca scp).
- Verificación: suite + smoke curl (PRM, ASM, 401 con header, token flow con un cliente de prueba).
- **Modelo recomendado: Opus** — es superficie de seguridad (AS, hashing, tokens), no desarrollo sobre plantilla (criterio docs/07). La recomendación previa de Sonnet aplicaba a la Opción A (solo validar JWT ajeno), que ya no existe.

**Fase 2 — Alta y prueba end-to-end** (era "el spike"; ahora valida implementación, no arquitectura)
- El Owner añade el custom connector (Organization settings → Connectors → Add → Custom → Web): URL del MCP + Client ID/Secret del AS. Reunión con el Owner: agendada (2026-07-22).
- Un gerente pulsa Connect → login usuario/contraseña en nuestro AS → **ÉXITO = connected + 5 tools + una tool responde**.
- Documentar en el runbook la vía OAuth para gerentes; el plugin queda **solo con la skill** (el conector deja de vivir en su `.mcp.json` — eso era el patrón PAT para CLI).

**Fase 3 — A2F y endurecimiento**
- TOTP sobre el login del AS; rate limiting/lockout del formulario; circuito operativo de reset de contraseña (hoy: `set-password` por CLI, manual).
- Futuro: si la Plataforma retoma SSO, este AS es la base (o se reevalúa IdP externo — D-041 lo deja "por los momentos").

## 5. Riesgos y validaciones

- **Somos custodios de contraseñas**: argon2id, rate limiting y lockout en el login, y política de reset definida (aunque sea manual por CLI) son parte de la Fase 1/3, no opcionales. Es el precio de descartar el IdP.
- **Discovery `.well-known` con path**: el matiz RFC 8414/9728 (path-inserted en la raíz del host) exige locations nuevas en Nginx; es el gotcha más probable de la prueba end-to-end.
- **Redirect URI**: match exacto de `https://claude.ai/api/mcp/auth_callback` en el cliente registrado.
- **Egress de Anthropic** (`160.79.104.0/21`): que ningún WAF lo bloquee; discovery/token < 10s.
- **Compatibilidad Claude↔AS propio**: menor que con Entra (controlamos el AS), pero la prueba de Fase 2 es el gate igualmente.

## 6. Qué NO hace este incremento

- **No toca el `dev-login`** ni introduce login usuario/contraseña en apps/api/apps/web (alcance = solo el conector; el AS podrá reutilizarse después).
- **No elimina el PAT**: sigue como auth de técnicos por Claude Code CLI.
- **No adopta Enterprise-managed auth** (descartado en D-040; con la salida de Entra, más lejos aún).
