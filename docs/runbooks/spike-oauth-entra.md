# [OBSOLETO 2026-07-21, D-041] Runbook — Spike OAuth con Entra ID para el conector Cowork

> **OBSOLETO — NO EJECUTAR.** La organización decidió no usar Entra ID para autenticación (D-041) antes de que este spike llegara a correr. La vía vigente es el AS propio con usuario/contraseña: ver `docs/08-auth-conector-oauth.md` y `docs/runbooks/oauth-conector-as-propio.md`. Se conserva solo como registro de los datos verificados de la doc de Anthropic (redirect URI, egress, no-DCR), ya trasladados al runbook nuevo.

> Objetivo: verificar en **staging** si Claude/Cowork conecta el MCP `awkfactory` por **OAuth con Entra ID como Authorization Server** (Opción A de `docs/08-auth-conector-oauth.md`). Es un **spike acotado y desechable** — endpoint mínimo + config de Entra + alta del conector + un gerente conecta. **No** es la implementación definitiva del guard.
>
> **Decisión que resuelve**: si el spike conecta limpio → seguimos con la Opción A (factory como resource server). Si falla o queda frágil → Opción B (factory como AS propio federando a Entra).
>
> Basado en doc oficial de Anthropic (claude.com/docs/connectors/building/authentication, sección Entra) y el spec MCP de autorización. Contexto: D-039/D-040.

## 0. Datos confirmados (no adivinados)

- **Redirect URI a registrar en Entra** (superficies hosted, incluida Cowork): `https://claude.ai/api/mcp/auth_callback`. (Claude Code usa loopback distinto — no aplica aquí.)
- **DCR y CIMD no sirven con Entra** (Entra no expone `registration_endpoint` ni anuncia CIMD). → **pre-registrar Client ID + Secret** e introducirlos al alta del custom connector.
- **Gotcha Entra oficial**: registrar la **URL canónica del MCP como Application ID URI** en la app de Entra, o el token falla con `AADSTS9010010`.
- Claude envía el parámetro **`resource`** (RFC 8707) = URL canónica del MCP (minúsculas, sin barra final, sin fragmento, sin puerto por defecto, **con el path**): `https://staging.apps.awakelab.world/factory-api/mcp`.
- **PKCE S256 obligatorio** (Entra lo soporta y lo anuncia). Todo **HTTPS**. Egress de Anthropic: **`160.79.104.0/21`** (que ni el MCP ni Entra lo bloqueen con WAF).
- Claude pide `offline_access` para refresh token si el AS lo lista en `scopes_supported` (Entra lo hace).

## 1. Prerrequisitos

- Acceso **admin de Entra ID** del tenant de Awakelab (para la app registration).
- Ser **Owner/Primary Owner** de la organización en Claude (para añadir el custom connector).
- `apps/factory` de **staging** sirviendo por HTTPS público (ya lo está: `https://staging.apps.awakelab.world/factory-api`).
- Tener a mano el **Tenant ID** de Entra.

## 2. App registration en Entra (una sola app: cliente + API)

Para el spike, una única app registration hace de cliente (la que usa Claude) y de API (la que define la audiencia).

1. **Entra admin center → App registrations → New registration**.
   - Name: `awkfactory-cowork-staging` (o similar).
   - Supported account types: **Single tenant** (solo Awakelab).
   - Redirect URI: plataforma **Web**, valor **exacto** `https://claude.ai/api/mcp/auth_callback`.
   - Registrar. Anota el **Application (client) ID** y el **Directory (tenant) ID**.
2. **Certificates & secrets → New client secret**. Anota el **Value** (secreto; se muestra una vez).
3. **Expose an API**:
   - **Application ID URI**: editar y poner **exactamente** la URL canónica del MCP: `https://staging.apps.awakelab.world/factory-api/mcp`.
     - ⚠️ Entra históricamente restringía el App ID URI a `api://<guid>` o `https://<dominio-verificado>` sin path. **Verificar que Entra acepta la URL con path `/factory-api/mcp`.** Si la RECHAZA, es el primer punto de fricción del spike → anotarlo y evaluar Opción B (o un App ID URI alternativo + mapeo de audiencia, más frágil).
   - **Add a scope**: nombre `mcp.access` (o similar); "Admins and users" pueden consentir (para evitar admin-consent bloqueante en el spike); descripción libre. Queda como `api://…/mcp.access` — pero la audiencia del token será el App ID URI.
4. **API permissions** (opcional en el spike): si el scope requiere admin consent, dar **Grant admin consent** para el tenant.

> Resultado: Entra emitirá access tokens con `aud` = el Application ID URI (= la URL del MCP), que es justo lo que Claude pide vía `resource`. Ese es el encaje clave.

## 3. Endpoint mínimo en `apps/factory` (staging) — solo lo del spike

No es el guard definitivo; es lo mínimo para que Claude descubra el AS y valide el token. Tres piezas:

### 3.a Protected Resource Metadata (RFC 9728)

Servir `GET /factory-api/.well-known/oauth-protected-resource` (público), JSON:

```json
{
  "resource": "https://staging.apps.awakelab.world/factory-api/mcp",
  "authorization_servers": ["https://login.microsoftonline.com/<TENANT_ID>/v2.0"],
  "scopes_supported": ["api://<APP_ID_URI>/mcp.access", "offline_access"],
  "bearer_methods_supported": ["header"]
}
```

- `resource` debe coincidir **exactamente** con la URL que el Owner escribe al alta del conector.
- `authorization_servers`: **solo el issuer de Entra** (Claude usa la primera entrada y no prueba las demás).
- Ojo con el discovery del AS: Claude prueba `…/.well-known/oauth-authorization-server` y cae a `…/.well-known/openid-configuration`. Con el issuer `…/v2.0` de Entra, el openid-configuration vive en `https://login.microsoftonline.com/<TENANT_ID>/v2.0/.well-known/openid-configuration`. Si el discovery falla por el `/v2.0` intermedio (matiz RFC 8414 de dónde va el `.well-known`), es el segundo punto a vigilar en el spike.

### 3.b 401 con `WWW-Authenticate` en el endpoint MCP

Cuando `/factory-api/mcp` recibe una request **sin token válido**, responder **401** con:

```
WWW-Authenticate: Bearer resource_metadata="https://staging.apps.awakelab.world/factory-api/.well-known/oauth-protected-resource", scope="api://<APP_ID_URI>/mcp.access"
```

(El `scope` en el header controla lo que Claude pide; si no, usa `scopes_supported` de la PRM.)

### 3.c Validación del token de Entra

En una rama de spike del `FactoryAuthGuard` (o un middleware temporal): validar el JWT de Entra —
- firma con la **JWKS de Entra** (`https://login.microsoftonline.com/<TENANT_ID>/discovery/v2.0/keys`),
- `iss` = `https://login.microsoftonline.com/<TENANT_ID>/v2.0`,
- **`aud` = el App ID URI** (aceptar el valor canónico, sin comparación byte-a-byte contra lo tecleado),
- `exp` vigente.

Para el spike basta con dejar pasar si el token valida (aún sin mapear a `factory_actors`); la autorización fina (email→gerente) se añade en la Fase 1 si el spike va bien.

> Nota de implementación: es una rama temporal. El PAT y el JWT de plataforma actuales del guard se mantienen intactos. No commitear esto a `main` como definitivo — es para probar; la versión final va en la Fase 1 de docs/08.

## 4. Alta del custom connector por el Owner (Claude)

1. **Organization settings → Connectors** (`claude.ai/admin-settings/connectors`).
2. **Add → Custom → Web**.
3. **URL**: `https://staging.apps.awakelab.world/factory-api/mcp` (idéntica al `resource` de la PRM).
4. **Advanced settings**: **OAuth Client ID** y **OAuth Client Secret** = los de la app de Entra (paso 2).
5. **Add**.

## 5. Prueba (un gerente)

1. El gerente va a **Customize → Connectors**, encuentra el conector custom y pulsa **Connect**.
2. Se abre el flujo OAuth → login en **Entra** con su cuenta de Awakelab → consentimiento.
3. **Criterio de ÉXITO**: el conector queda **connected**, muestra las **5 tools**, y una tool (p. ej. `list_modules`) responde en un chat de Cowork.
4. **Criterio de FALLO/fricción**: cualquier bloqueo en (a) App ID URI con path rechazado por Entra, (b) discovery del AS por el `/v2.0`, (c) `AADSTS9010010` (audiencia), (d) redirect URI, (e) egress/WAF. Anotar cuál.

## 6. Decisión

- **Conecta limpio** → **Opción A** confirmada: implementar la Fase 1 de docs/08 (resource server definitivo en el guard + mapeo a `factory_actors`). Nueva entrada en DECISIONES.
- **Falla/frágil** → **Opción B**: `apps/factory` como AS propio (librería OIDC) federando a Entra. Nueva entrada en DECISIONES con el motivo concreto del fallo.

## 7. Checklist de gotchas (para diagnosticar rápido)

| Síntoma | Causa probable |
|---|---|
| `AADSTS9010010` al pedir token | Falta registrar la URL del MCP como **Application ID URI** en Entra (paso 2.3). |
| Entra rechaza el App ID URI con path | Restricción de formato de Entra → punto de fricción; evaluar Opción B. |
| Claude no descubre el AS | `authorization_servers` mal, o discovery del `/v2.0` (openid-configuration) no resoluble. |
| Redirect / "invalid redirect_uri" | El redirect URI en Entra no es **exactamente** `https://claude.ai/api/mcp/auth_callback`. |
| Conecta pero el MCP da 401 | El guard no valida bien `aud`/`iss`/firma, o `aud` ≠ App ID URI. |
| Timeout en la conexión | Egress de Anthropic (`160.79.104.0/21`) bloqueado por WAF en el MCP o en Entra; o discovery/token > 10s. |
| No llega refresh token | Falta `offline_access` en `scopes_supported` del AS/PRM. |
