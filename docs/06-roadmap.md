# 06 · Roadmap

Principio: **validar el pipeline con humanos en el loop antes de automatizar**, y automatizar por etapas lo que ya funciona manualmente.

## Fase 0 — Fundaciones (semanas 1–4)

- Monorepo `awkplatform` con la estructura de [02](02-stack.md): shell React + Tailwind/shadcn con tokens de marca Awakelab, API NestJS con core mínimo (auth SSO, RBAC, usuarios), Postgres + Prisma, CI completo.
- **Plantilla de módulo** de referencia: construir a mano 1 módulo ejemplar (elegir un prototipo real sencillo). Esta plantilla es el activo más importante de la fábrica.
- Provisionar el Lightsail (32GB/640GB, red privada del grupo), Nginx + certbot, Docker, **Lightsail managed PostgreSQL** (plan $30, modo privado; una BD `staging` y una `production` en la misma instancia al inicio), GitHub Actions→GHCR→deploy por webhook. Probar un restore point-in-time antes de dar por cerrada la fase.

## Fase 1 — Fábrica asistida (semanas 5–10)

- Migrar el control plane actual al stack estándar (la API Express+Mongo actual se reescribe: era la decisión correcta como arranque, pero la fábrica debe comer su propia comida). Conservar conceptualmente el dashboard y el stepper.
- Pipeline **semiautomático**: análisis y generación con Agent SDK lanzados por un dev, con specs y gates reales. Convertir 2–3 prototipos existentes de la cola actual.
- Métrica de éxito: % del módulo utilizable sin retoque manual; cada retoque recurrente → mejora de plantilla o prompts.

## Fase 2 — Integración Cowork (semanas 11–16)

- Remote MCP server + plugin de organización (skill `awk-prototipo` + conector) publicado en el marketplace privado.
- Skill de prototipado con `prototype.manifest.json` desplegada a los gerentes; los prototipos nuevos ya entran normalizados.
- Dashboard v2 con aprobación de specs y preview links.

## Fase 3 — Automatización completa (semanas 17–24)

- Cola de trabajos, runners en contenedor, iteración automática contra CI, auto-merge de PRs triviales, promoción staging→producción con aceptación del gerente.
- `request_change` operativo (mantenimiento desde Cowork).
- Migración progresiva del backlog de prototipos existentes; deprecación de las soluciones duplicadas a favor de módulos unificados.

## Fase 4 — Consolidación y expansión (mes 7+)

- Hardening: auditoría, RLS en todos los módulos confidenciales, observabilidad completa.
- Evaluar extensión al grupo (30 empresas): la decisión multi-tenant (una plataforma por empresa vs tenancy real) se toma aquí, con datos de uso — no antes.

## Riesgos principales y mitigación

| Riesgo | Mitigación |
|---|---|
| Calidad de generación insuficiente en casos complejos | La spec + gates existen para eso; los casos complejos siempre pasan por revisor. Empezar por prototipos simples. |
| La plantilla de módulo se queda corta | Tratarla como producto vivo con versionado; cada fricción del revisor es un issue de plantilla. |
| Cuello de botella se traslada a la revisión | Medir tiempo-en-gate; ajustar criterios de auto-aprobación con datos. |
| Dependencia de una persona (bus factor) en la fábrica | Documentación (estos docs) + al menos 2 devs rotando como revisores desde Fase 1. |
| Coste de API de generación | Presupuesto por proyecto visible en el dashboard; el análisis (barato) siempre corre, la generación espera aprobación. |
