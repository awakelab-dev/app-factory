# Plugin `awk-prototipo`

Plugin de organización de Awakelab para Cowork/Claude Code: convierte la sesión de un gerente en el punto de entrada de la Fábrica (AwkFactory).

## Componentes

- **Skill `awk-prototipo`** — guía el prototipado: identidad Awakelab 2026, preguntas de negocio, clasificación de sensibilidad por entidad (docs/05), y produce `prototype.html` + `prototype.manifest.json` antes de enviar.
- **Conector MCP `awkfactory`** (`.mcp.json`) — remote MCP de la Fábrica en `https://apps.awakelab.world/factory-api/mcp` con las 5 tools del contrato v1: `list_modules`, `submit_prototype`, `get_project_status`, `request_change`, `approve_spec`.

## Requisitos

- **`AWKFACTORY_TOKEN`**: PAT personal (prefijo `awkf_`) emitido por el CLI de la Fábrica (`create-actor`). El conector lo envía como `Authorization: Bearer ${AWKFACTORY_TOKEN}` — la variable debe existir en el entorno de la sesión.

Instalación completa (marketplace privado + dónde poner el token, incl. app de escritorio): ver `docs/runbooks/plugin-awk-prototipo.md` en este repo.

## Apuntar a staging (solo pruebas)

El conector apunta a producción. Para probar contra staging, instalar desde una copia local del plugin con la URL de `.mcp.json` cambiada a `https://staging.apps.awakelab.world/factory-api/mcp` (y un PAT emitido contra la BD de staging). No publicar esa copia.
