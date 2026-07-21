# Runbook — OAuth del conector Cowork con AS propio (Fases 1–2 de docs/08)

> Objetivo: montar en `apps/factory` el **Authorization Server + Resource Server propio** con login usuario/contraseña (D-041) y validar el conector end-to-end en **staging**. Reemplaza al runbook OBSOLETO `spike-oauth-entra.md` (la org descartó Entra para autenticación).
>
> Contexto y arquitectura: `docs/08-auth-conector-oauth.md`. Datos confirmados de la doc oficial de Anthropic que siguen valiendo: redirect URI hosted (incl. Cowork) = `https://claude.ai/api/mcp/auth_callback`; pre-registro de Client ID/Secret al alta del conector (Advanced settings); Claude manda `resource` (RFC 8707) = URL canónica del MCP (minúsculas, sin barra final, con path): `https://staging.apps.awakelab.world/factory-api/mcp`; PKCE S256; egress de Anthropic `160.79.104.0/21`; Claude pide `offline_access` si el AS lo lista en `scopes_supported`.

## 1. Prerrequisitos

- `apps/factory` de staging sirviendo por HTTPS público (ya: `https://staging.apps.awakelab.world/factory-api`).
- Ser **Owner** de la org en Claude para el alta del conector (reunión agendada 2026-07-22) — la implementación de Fase 1 NO lo necesita.
- Acceso SSH al Lightsail para la migración y el edit de Nginx (a mano con `nano`, **nunca scp** — incidente certbot).

## 2. Fase 1 — Implementación en `apps/factory`

### 2.a Datos y CLI

1. Migración aditiva: `passwordHash TEXT NULL` en `factory_actors` + tablas `oauth_*` que exija el adapter de la librería (códigos, grants/sesiones, refresh). Migración a mano como todas (sin schema-engine en el sandbox).
2. Hash **argon2id** (dependencia `argon2`). CLI: `set-password --email <e>` (prompt oculto, guarda solo el hash) — reutiliza el patrón de `create-actor`. Un actor sin `passwordHash` no puede hacer login OAuth (los técnicos solo-PAT no lo necesitan).

### 2.b Authorization Server

3. Librería candidata: `node-oidc-provider`. **Checklist de idoneidad antes de adoptarla** (si falla algo, evaluar alternativa, jamás flujo a mano): Resource Indicators RFC 8707, rotación de refresh tokens, PKCE S256 obligatorio, adapter de persistencia custom (Prisma), interacción de login custom (nuestro formulario usuario/contraseña), y dónde publica discovery.
4. Montarlo bajo `/factory-api/oauth` (issuer = `https://staging.apps.awakelab.world/factory-api/oauth`). Formulario de login: email + contraseña → valida contra `factory_actors` activo + argon2. Fila inactiva/revocada o sin hash → login denegado (mismo mensaje genérico, no filtrar cuál).
5. Cliente `claude` pre-registrado (seed/config): `client_id` propio, `client_secret` generado (mostrar una vez, hash en BD — criterio PAT), redirect URI **exacto** `https://claude.ai/api/mcp/auth_callback`, grant `authorization_code` + `refresh_token`.
6. Access token JWT firmado por el AS (JWKS propio persistido), **`aud` = URL canónica del MCP**, vida corta (~1h); refresh rotativo; `offline_access` en `scopes_supported`.

### 2.c Resource Server

7. PRM `GET /factory-api/.well-known/oauth-protected-resource` (público):

```json
{
  "resource": "https://staging.apps.awakelab.world/factory-api/mcp",
  "authorization_servers": ["https://staging.apps.awakelab.world/factory-api/oauth"],
  "scopes_supported": ["offline_access"],
  "bearer_methods_supported": ["header"]
}
```

   `resource` idéntico a la URL que el Owner teclea al alta. `authorization_servers`: solo nuestro AS.
8. 401 con `WWW-Authenticate` en `/factory-api/mcp` sin token válido:

```
WWW-Authenticate: Bearer resource_metadata="https://staging.apps.awakelab.world/factory-api/.well-known/oauth-protected-resource"
```

9. Tercera rama en `FactoryAuthGuard`: JWT del AS propio (firma con nuestra JWKS, `iss` = el issuer, `aud` = URL del MCP, `exp`) → `email` → fila **activa** de `factory_actors` → `request.actor {email, rol}`. Email válido en el token pero sin fila activa → 403. PAT y JWT de plataforma intactos. Tests: token válido / firma mala / `aud` mala / expirado / email no autorizado.

### 2.d Nginx — el gotcha del `.well-known` en la raíz

RFC 8414/9728 ponen el discovery en la **raíz del host** con el path insertado. Con issuer/resource bajo `/factory-api/...`, Claude puede pedir cualquiera de:

- `/.well-known/oauth-authorization-server/factory-api/oauth`
- `/.well-known/openid-configuration/factory-api/oauth`
- `/.well-known/oauth-protected-resource/factory-api/mcp`

Hoy la raíz del host la sirve el contenedor web → añadir al `.conf` de staging (a mano) un location que enrute `/.well-known/oauth-*` y `/.well-known/openid-configuration*` al contenedor factory, y que factory responda tanto la forma raíz (path-inserted) como la forma bajo `/factory-api/`. El `WWW-Authenticate` con URL explícita cubre la PRM, pero **para el discovery del AS no hay atajo equivalente**: este paso no es opcional.

### 2.e Verificación (antes de tocar al Owner)

- Suite verde (patrón D-023 si el mount no coopera) + lint/typecheck/build.
- Smoke por HTTPS: PRM (ambas formas), ASM/openid-configuration del AS, 401 con header en `/mcp`, y un Authorization Code + PKCE completo con un cliente de prueba → token → `tools/list` del MCP con ese token = 5 tools. **Script listo (D-042): `node apps/factory/scripts/oauth-smoke.mjs --base https://staging.apps.awakelab.world --client-id claude --client-secret <secret> --email <gerente> --password '<pwd>'`** (Node 22+, sin deps; hace login por POST y para en el primer fallo indicando el punto exacto). Sin `--email/--password` corre solo los checks de metadata/401.
- Deploy: merge a main con CI verde → deploy automático de staging → `~/migrate-factory.sh staging latest` (EN el Lightsail; SOLO tras CI de main verde).

## 3. Fase 2 — Alta del conector y prueba (necesita al Owner)

1. Owner: **Organization settings → Connectors → Add → Custom → Web** (`claude.ai/admin-settings/connectors`).
2. URL: `https://staging.apps.awakelab.world/factory-api/mcp` (idéntica al `resource` de la PRM). Advanced settings: Client ID/Secret del cliente `claude` de NUESTRO AS.
3. Un gerente (con fila activa en `factory_actors` + contraseña ya seteada por CLI): **Customize → Connectors → Connect** → formulario de login de nuestro AS → consentimiento.
4. **ÉXITO** = conector connected + 5 tools visibles + `list_modules` responde en un chat de Cowork. → cerrar con entrada en DECISIONES, actualizar STATUS y docs/08, y planificar el alta de producción + Fase 3 (A2F).
5. **FALLO** = anotar el punto exacto (discovery, redirect, token, aud, egress) — es bug de implementación a corregir, ya no decisión de arquitectura (D-041).

## 4. Checklist de gotchas

| Síntoma | Causa probable |
|---|---|
| Claude no descubre el AS | Falta el location raíz `/.well-known/...` en Nginx (§2.d), o el AS no responde la forma path-inserted. |
| "invalid redirect_uri" | El cliente `claude` del AS no tiene **exactamente** `https://claude.ai/api/mcp/auth_callback`. |
| Conecta pero el MCP da 401 | La rama del guard no valida bien `iss`/`aud`/firma, o el AS emite `aud` ≠ URL canónica del MCP. |
| Login correcto pero 403 | Actor sin fila activa en `factory_actors` (por diseño) — crearla con `create-actor`. |
| No llega refresh token | `offline_access` ausente de `scopes_supported`, o rotación mal configurada. |
| Timeout | Egress `160.79.104.0/21` bloqueado por WAF, o discovery/token > 10s. |
| Login rechazado siempre | Actor sin `passwordHash` (set-password pendiente) o hash de otra época — reponer por CLI. |
