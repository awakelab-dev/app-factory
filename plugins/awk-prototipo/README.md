# Plugin `awk-prototipo`

Plugin de organización de Awakelab para Cowork/Claude Code: convierte la sesión de un gerente en el punto de entrada de la Fábrica (AwkFactory).

## Componentes

- **Skill `awk-prototipo`** — guía el prototipado: identidad Awakelab 2026, preguntas de negocio, clasificación de sensibilidad por entidad (docs/05), y produce `prototype.html` + `prototype.manifest.json` antes de enviar.
- **Conector MCP `awkfactory`** (`.mcp.json`) — remote MCP de la Fábrica en `https://apps.awakelab.world/factory-api/mcp` con las tools del contrato: `list_modules`, `list_projects`, `submit_prototype`, `get_project_status`, `request_change`, `approve_spec`.

## Autenticación — OAuth (D-042b)

El conector usa **OAuth 2.1** contra el Authorization Server propio de la Fábrica. No lleva ningún token ni secreto en `.mcp.json`: al primer uso, el cliente recibe un 401 con `WWW-Authenticate`, descubre el AS (PRM/ASM), se **auto-registra por DCR** (RFC 7591) y abre el navegador para que la persona **inicie sesión con sus credenciales de la Fábrica** (email + contraseña). Sin Client ID/Secret que distribuir.

Requisito por persona: tener una **fila activa en `factory_actors` + contraseña**, provisionada por la Fábrica (`create-actor` + `set-password`). Ese es el único gate de acceso — quien no esté provisionado no entra, por más que tenga el plugin instalado.

En organizaciones Claude **gestionadas**, el **admin de cada org habilita el conector una vez** para su equipo (política de Anthropic; una acción por org, no por usuario). Cuentas que permitan añadir conectores lo hacen self-serve.

Onboarding e instalación completos: ver `docs/runbooks/plugin-awk-prototipo.md`.

## Apuntar a staging (solo pruebas)

El conector apunta a producción. Para probar contra staging, usar la URL `https://staging.apps.awakelab.world/factory-api/mcp` (el flujo OAuth es idéntico; no hay token que cambiar). Para pruebas locales del flujo sin depender de un admin, `apps/factory/scripts/oauth-login-test.mjs` (cliente público `dev-local`).
