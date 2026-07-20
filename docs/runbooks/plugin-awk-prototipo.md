# Runbook — Instalación del plugin `awk-prototipo` (marketplace privado + token)

Fuente del plugin: `plugins/awk-prototipo/` en este repo (skill `awk-prototipo` + conector MCP `awkfactory`). Marketplace privado: este mismo repo (`.claude-plugin/marketplace.json` en la raíz). Contexto de diseño: D-036/D-037, docs/04.

## 1. Emitir el PAT del gerente

Por gerente y por entorno (staging y producción tienen BDs de fábrica separadas — el PAT de staging NO sirve en producción):

```bash
# túnel SSH a la managed PG (como en D-031) + .env apuntando por el túnel
pnpm --filter=@awk/factory run cli -- create-actor --email <gerente>@awakelab.dev --role gerente
```

- El token (`awkf_…`) se imprime UNA sola vez; en BD queda solo el hash.
- Reemitir para el mismo email crea token nuevo y REVOCA los anteriores.
- Entregarlo al gerente por canal seguro (gestor de contraseñas, nunca email/Slack en claro).

## 2. Poner el token en el entorno de la sesión (el punto delicado)

> ⚠️ **IMPORTANTE (D-039, 2026-07-20)**: lo de esta sección aplica a **Claude Code CLI** (conecta desde local). **NO funciona en Cowork/Claude Desktop**: los conectores de Cowork corren desde la **nube de Anthropic**, no desde el Mac (doc oficial), así que NO ven variables locales (`settings.json` ni `launchctl`). Para el conector de **gerentes en Cowork** el PAT-en-header no sirve → se replantea a OAuth (ver §6). El PAT sigue siendo válido para técnicos por CLI.

El conector lleva `"Authorization": "Bearer ${AWKFACTORY_TOKEN}"`. La expansión `${VAR}` en headers de `.mcp.json` está **documentada** (docs.claude.com/en/docs/claude-code/mcp, "Environment variable expansion in .mcp.json"; también `${VAR:-default}`) y **verificada en vivo** con Claude Code v2.1.215 (STATUS 2026-07-20). Si la variable no existe, el config carga igual con warning y el header viaja con el texto literal → 401.

**Problema**: la app de escritorio (Cowork) NO hereda el shell del usuario (las apps GUI de macOS no leen `~/.zshrc`), así que `export AWKFACTORY_TOKEN=…` en el shell no basta.

**Vía recomendada — `~/.claude/settings.json`** (el bloque `env` aplica variables de entorno a cada sesión; documentado en docs.claude.com/en/docs/claude-code/settings y NO depende del shell):

```json
{
  "env": {
    "AWKFACTORY_TOKEN": "awkf_…"
  }
}
```

> **Estado**: documentado para Claude Code; que la app de escritorio lo aplique a la expansión de headers está **pendiente de verificar en el Mac** (primera prueba real del incremento B). Es la hipótesis fuerte: Cowork corre sobre Claude Code y lee los mismos settings.

**Fallback si settings.json no lo aplicara** (entorno de GUI de macOS):

```bash
launchctl setenv AWKFACTORY_TOKEN "awkf_…"   # vale hasta el reboot; reiniciar la app después
```

(persistente: un LaunchAgent que ejecute ese `setenv` al login — documentarlo solo si hace falta).

## 3. Instalar el plugin

Dos vías según el perfil:

**a) Técnicos (Leonardo) — marketplace privado por git** (requiere acceso de lectura al repo `awakelab-dev/app-factory`):

```bash
claude plugin marketplace add awakelab-dev/app-factory
claude plugin install awk-prototipo@awakelab
```

**b) Gerentes — archivo `.plugin` (recomendado hoy)**: los gerentes no tienen acceso al repo. Empaquetar y distribuir el zip:

```bash
cd plugins/awk-prototipo && zip -r /tmp/awk-prototipo.plugin . -x "*.DS_Store"
```

El gerente instala el `.plugin` desde Cowork (vista previa + botón de instalación). Contra: las actualizaciones son manuales (redistribuir el archivo). Cuando la organización configure marketplaces gestionados a nivel admin, migrar a esa vía.

## 4. Probar contra staging antes de producción

El `.mcp.json` publicado apunta a **producción**. Para la prueba real:

1. Copia local del plugin con la URL cambiada a `https://staging.apps.awakelab.world/factory-api/mcp` (no commitear ni publicar esa copia).
2. PAT emitido contra `awkfactory_staging` (el primero ya existe: emitido 2026-07-20, en el gestor de Leonardo).
3. En Cowork: verificar conector `awkfactory` conectado + autenticado + 5 tools.
4. Prototipar algo pequeño con la skill de punta a punta → debe llegar como submission `received` al proyecto en `/factory` de staging.

Para producción: `create-actor` contra `awkfactory_production` (no existe aún ningún PAT allí) y el plugin publicado tal cual.

## 5. Diagnóstico rápido

| Síntoma | Causa probable |
|---|---|
| Conector "unauthenticated" / tools fallan con 401 | `AWKFACTORY_TOKEN` no está en el entorno de la sesión (paso 2), token revocado, o PAT del entorno equivocado (staging vs producción). El 401 es idéntico a propósito para token inexistente y revocado. |
| Warning de variable ausente al listar MCP | La variable no se expandió — el header viaja literal. Revisar paso 2 y reiniciar la app. |
| `submit_prototype` devuelve 409 | Slug ya existe: usar `request_change` sobre el módulo o cambiar `moduleSlug`. |
| Error de validación del manifest | Revisar `plugins/awk-prototipo/skills/awk-prototipo/references/manifest.md` (límites, literales de `sensitivity`). |
| PAT de 401 aunque "parece" bien | Verificar longitud **69** (`awkf_` + 64 hex). Un token truncado al copiar (p. ej. 24 chars) da 401 idéntico al de revocado. `python3 -c "import json,os;t=json.load(open(os.path.expanduser('~/.claude/settings.json')))['env']['AWKFACTORY_TOKEN'];print(len(t))"`. |
| Plugin instalado por `claude plugin install` no aparece en Cowork | Correcto: el CLI instala a scope Claude Code, Cowork NO lo carga. En Cowork **subir el `.plugin`** desde la app (§3.c). |
| Conector con *Install* deshabilitado, tooltip "Contact an organization owner…" | Org gestionada: un Owner debe habilitar el conector a nivel org. No es un fallo de token. Ver §6. |

## 6. Hallazgos de la prueba real en Cowork (D-039, 2026-07-20)

La prueba end-to-end en Cowork (Mac de Leonardo) reveló que **la auth interina por PAT-en-header es incompatible con el conector de Cowork**. Resumen accionable:

- **Longitud del PAT**: un PAT válido son **69 caracteres** (`awkf_` + `randomBytes(32).toString('hex')`, `actors.service.ts:45`). Verificar al pegar (una copia truncada da 401). Con el token completo, `curl` al MCP de staging responde **200** — endpoint y PAT son correctos.
- **Instalar en Cowork ≠ CLI**: `claude plugin marketplace add`/`install` instala a nivel Claude Code (scope user) y **Cowork no lo ve**. En Cowork hay que **subir el archivo `.plugin`** desde la app (la tarjeta de un `.plugin` trae el botón "Save plugin"). Queda en `~/…/.remote-plugins/<id>/`.

### 6.a Vía de instalación del `.plugin` (Cowork)

```bash
cd plugins/awk-prototipo && zip -r /tmp/awk-prototipo.plugin . -x "*.DS_Store"
# subir /tmp/awk-prototipo.plugin desde la app (no por CLI)
```

Para probar **staging**: copia local con la URL cambiada a `https://staging.apps.awakelab.world/factory-api/mcp`, empaquetar igual y subir. No commitear esa copia.

### 6.b El bloqueo: conectores de Cowork corren desde la nube

Doc oficial (support.claude.com, "Use connectors to extend Claude's capabilities", Custom connectors): los custom connectors *"connect to your MCP server from Anthropic's cloud, not from your local device. This is true even if you're using Cowork or Claude Desktop"*; el servidor debe ser alcanzable por **internet público** (staging lo es). Consecuencia: `Authorization: Bearer ${AWKFACTORY_TOKEN}` expandido desde variable LOCAL **no funciona en Cowork** (la nube no ve `settings.json`/`launchctl`). Solo funciona en el CLI (que conecta desde local).

Además, en org Team/Enterprise el *Install* del conector lo habilita un **Owner** (Organization settings → Connectors → Browse connectors → Add to your team), y el alta de custom connector pide **OAuth (Client ID/secret)**, no un bearer estático.

### 6.c Camino a seguir

El conector de **gerentes** se replantea a **OAuth** (adelanta docs/05) y/o **Enterprise-managed auth**; el **PAT-en-header** se conserva solo para técnicos por **Claude Code CLI**. La prueba real de gerentes queda bloqueada hasta implementar la auth OAuth en el MCP de `apps/factory` y que un owner habilite el conector a nivel org.
