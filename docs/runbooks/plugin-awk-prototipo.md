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
