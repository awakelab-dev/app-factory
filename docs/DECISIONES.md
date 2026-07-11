# DECISIONES — Log de decisiones estructurales (append-only)

> Formato: `D-NNN · fecha · decisión · por qué (1-2 líneas)`. Nunca editar entradas pasadas; si una decisión se revierte, añadir una nueva que la sustituya referenciándola.

- **D-001** · 2026-07-10 · Plataforma modular (core común + módulos), no apps standalone. — Resuelve fragmentación, duplicación y control de datos sensibles a la vez.
- **D-002** · 2026-07-10 · Stack 100% TypeScript: React+Vite, Tailwind+shadcn/ui, NestJS, PostgreSQL+Prisma, monorepo pnpm+Turborepo. — Un solo lenguaje, estructura rígida ideal para generación con IA, equipo domina JS/TS.
- **D-003** · 2026-07-10 · Infra en AWS Lightsail 32GB/640GB en la red privada del grupo; Docker Compose sin PaaS; Nginx nativo en host; GitHub Actions→GHCR→deploy por webhook. — Alineado con la operación existente (36 Moodles); Docker por paridad CI↔prod, rollback por tag y aislamiento de runners.
- **D-004** · 2026-07-11 · BD: Lightsail managed PostgreSQL desde el día 1, plan Standard $30/mes (2GB/80GB, cifrado en reposo, modo privado). Descartados: plan $15 (sin cifrado), Aurora (costo), MongoDB (rigor relacional es ventaja para la fábrica). — Backups PITR gestionados y familiarización temprana con el entorno definitivo por $30/mes.
- **D-005** · 2026-07-10 · Integración Cowork vía plugin de organización: skill `awk-prototipo` + conector MCP remoto contra la API de la fábrica. Sin ZIPs manuales. — Normaliza la entrada y da seguimiento/mantenimiento desde Cowork.
- **D-006** · 2026-07-10 · Pipeline con spec intermedia y gates humanos (spec + PR), obligatorios ante datos sensibles, migraciones al core o complejidad alta. — La spec es el punto de encuentro negocio↔técnica y hace la generación auditable.
- **D-007** · 2026-07-11 · Trabajo por tareas independientes de Cowork con contexto vivo en el repo (CLAUDE.md + STATUS.md + este log) y selección de modelo por tipo de tarea. — Ver `docs/07-metodo-de-trabajo.md`.
- **D-008** · 2026-07-11 · Prototipo original movido a `legacy/` (referencia conceptual; se elimina al reconstruir el dashboard en Fase 1). Este repo queda limpio para alojar el monorepo. Añadido `.gitignore`; `node_modules` y `backend/.env` sacados del tracking. — Evitar que tareas futuras contaminen el desarrollo tomando el prototipo como base.
