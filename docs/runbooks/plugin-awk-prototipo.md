# Runbook — plugin `awk-prototipo` + onboarding (OAuth, D-042b)

Fuente: `plugins/awk-prototipo/` (skill + conector MCP `awkfactory`). Marketplace privado: `.claude-plugin/marketplace.json` en la raíz del repo. El conector usa **OAuth** contra el Authorization Server propio de la Fábrica (docs/08, D-041/D-042); ya NO usa PAT-en-header (eso queda solo para técnicos por Claude Code CLI, ver nota histórica al final).

## Modelo de escala (varias organizaciones Claude separadas)

Tres piezas independientes:

| Pieza | Cómo se distribuye | Quién / cuántas veces |
|---|---|---|
| **Autorización** (quién puede usar la Fábrica) | fila en `factory_actors` + contraseña | **Central**: la Fábrica, 1 vez por persona (cualquier cuenta/org/externo). |
| **Registro del cliente OAuth** | **DCR** (RFC 7591), auto | Cero. Cada cliente Claude se auto-registra; sin Client ID/Secret que repartir. |
| **Skill + conector (el plugin)** | marketplace privado o archivo `.plugin` | Usuario (self-serve) donde se permita; en orgs gestionadas, el **admin de cada org habilita el conector 1 vez** para su equipo. |

Clave: distribuir el plugin NO da acceso. El acceso lo da el login OAuth contra `factory_actors`. Por eso se puede repartir ancho sin riesgo, y revocar es `revoke-actor`.

## 1. Onboarding de una persona (central — lo hace la Fábrica)

Por entorno (staging y producción tienen BDs separadas). Vía túnel SSH a la managed PG (patrón D-031); `<ENDPOINT>`/`<PASS>` salen de `FACTORY_DATABASE_URL` en `/opt/awkfactory/<entorno>/.env`.

```bash
# Terminal A — túnel (dejar abierto)
ssh -N -L 5433:<ENDPOINT>:5432 AWK-Dev

# Terminal B — desde el repo
export FACTORY_DATABASE_URL='postgresql://app_factory_<entorno>:<PASS>@localhost:5433/awkfactory_<entorno>?sslmode=require&uselibpqcompat=true'
pnpm --filter=@awk/factory run cli -- create-actor  --email <persona>@<dominio> --role gerente
pnpm --filter=@awk/factory run cli -- set-password  --email <persona>@<dominio>   # prompt oculto, mín. 12
```

- La persona entra con **ese email + esa contraseña** en el formulario de login del AS (no con su cuenta de Claude).
- Revocar acceso: `revoke-actor --email <persona>@<dominio>`.

## 2. Habilitar el conector por organización (admin de cada org, 1 vez)

En organizaciones Claude gestionadas, un admin/Owner habilita el conector para su equipo (política de Anthropic — no se puede saltar; es **una acción por org, no por usuario**):

- Organization settings → Connectors → Add → Custom → Web (o "Browse connectors → Add to your team").
- **URL**: `https://apps.awakelab.world/factory-api/mcp` (producción) o `https://staging.apps.awakelab.world/factory-api/mcp` (staging).
- **No hace falta Client ID/Secret**: con DCR el cliente se auto-registra. (Si la UI los exige igualmente, usar el cliente `claude` pre-registrado: Client ID `claude` + el `FACTORY_OAUTH_CLIENT_SECRET` del `.env`.)

Cuentas personales/externas que permitan añadir conectores: lo hacen ellas mismas con la misma URL.

## 3. Instalar el plugin + conectar (usuario)

- **Marketplace privado** (técnicos con acceso al repo):
  ```bash
  claude plugin marketplace add awakelab-dev/app-factory
  claude plugin install awk-prototipo@awakelab
  ```
- **Archivo `.plugin`** (quien no tiene acceso al repo; se sube desde la app de Cowork):
  ```bash
  cd plugins/awk-prototipo && zip -r /tmp/awk-prototipo.plugin . -x "*.DS_Store"
  ```
- **Conectar**: al primer uso del conector, Claude abre el navegador → login en el formulario del AS (email/contraseña del paso 1) → consentimiento → listo. **ÉXITO** = conector conectado + 5 tools + `list_modules` responde.

## 4. Probar el flujo SIN depender de un admin (dev/staging)

Para iterar sin el alta del admin (útil antes de la reunión con cada Owner):

- **Flujo real en tu navegador** (cliente público `dev-local`, solo si `FACTORY_OAUTH_DEV_REDIRECT` está en el `.env` de staging):
  ```bash
  node apps/factory/scripts/oauth-login-test.mjs --base https://staging.apps.awakelab.world
  ```
- **Chequeo headless de cada deploy** (cliente `claude`):
  ```bash
  node apps/factory/scripts/oauth-smoke.mjs --base https://staging.apps.awakelab.world \
    --client-id claude --client-secret <secret> --email <persona> --password '<pwd>'
  ```

## 5. Diagnóstico rápido

| Síntoma | Causa probable |
|---|---|
| `invalid_client` al iniciar el flujo | El cliente no existe: DCR deshabilitado, o `dev-local` sin `FACTORY_OAUTH_DEV_REDIRECT` en el `.env` del contenedor (recordá `-p awk-staging` al recrear). |
| Login correcto pero **403** al usar tools | El email logueado no tiene fila **activa** en `factory_actors` (paso 1) — `create-actor`. |
| Login siempre rechazado | Sin `passwordHash` (falta `set-password`) o contraseña de otra época. |
| Conector con *Install* deshabilitado ("Contact an organization owner") | Org gestionada: el admin debe habilitar el conector (paso 2). No es fallo de auth. |
| `submit_prototype` → 409 | Slug ya existe: `request_change` sobre el módulo o cambiar `moduleSlug`. |
| Discovery/`/mcp` 404 por HTTPS | Falta el bloque Nginx `/.well-known/oauth-*`+`openid-configuration*` a la raíz → contenedor factory (runbook oauth §2.d/2.f). |

## Nota histórica (PAT → OAuth)

El diseño original (D-036) usaba un PAT (`awkf_…`) en `Authorization: Bearer` del `.mcp.json`. La prueba real en Cowork (D-039) mostró que **los conectores de Cowork corren desde la nube de Anthropic**, no ven variables locales, y que las orgs gestionadas exigen alta por un admin — por eso el PAT-en-header **solo sirve para técnicos por Claude Code CLI** (que conecta desde local). El conector de gerentes migró a **OAuth con AS propio** (D-041) e implementado/validado en staging (D-042/D-042b). El PAT sigue vigente en el `FactoryAuthGuard` para el uso CLI; el `.mcp.json` del plugin ya no lleva token.
