# STATUS — Estado vivo del proyecto

> Actualizar al cerrar CADA sesión de trabajo. Este archivo es lo primero que lee cualquier tarea nueva.

**Última actualización**: 2026-07-11 (sesión CI GitHub Actions + Dockerfiles)
**Fase actual**: Fase 0 — Fundaciones (core mínimo construido; CI lista; verificación local con BD y primer PR de prueba en curso)

## Hecho

- Estrategia completa documentada y aprobada (`docs/01..06`).
- Infraestructura decidida: Lightsail 32GB + Lightsail managed PostgreSQL $30 (ver DECISIONES D-001..D-004).
- Sistema de trabajo por tareas definido (`docs/07-metodo-de-trabajo.md`).
- Prototipo original movido a `legacy/` (D-008).
- Monorepo pnpm+Turborepo verde con hello world tipado end-to-end (D-009).
- **Core mínimo** (2026-07-11): modelos Prisma del schema PG `core` (`users`, `roles`, `user_roles`, `audit_events`) con migración inicial `core_init` + seed idempotente (roles admin/user, usuarios dev `leonardo.barreto@awakelab.dev`=admin y `demo@awakelab.dev`=user); **auth**: `POST /api/auth/dev-login` (solo email contra usuarios sembrados, deshabilitado con `NODE_ENV=production`) emite JWT HS256 de plataforma, `GET /api/auth/me`; **RBAC**: guards globales `JwtAuthGuard`+`RolesGuard` con decoradores `@Public()`/`@Roles()` y la regla `canAccess` de `@awk/auth` compartida api↔web; **auditoría**: `AuditService` global (append-only, nunca tumba la operación); **manifests**: `moduleManifestSchema` en `@awk/types`, módulos de ejemplo `hello` y `core-admin` (`GET /api/core/users` solo admin) — el shell web construye menú y rutas desde los manifests filtrando por roles, con login dev y sesión en localStorage. Migración a Prisma 7 real: generador `prisma-client` sin engines Rust + adapter pg (D-010); patrón auth/RBAC/manifest fijado (D-011). `turbo build/test/lint/typecheck` verdes y smoke test de la API sin BD (hello 200, me 401, zod 400).
- **CI GitHub Actions + Dockerfiles** (2026-07-11): `.github/workflows/ci.yml` — job `build-test` (pnpm install, `prisma migrate deploy` contra Postgres 18 de servicio efímero con las credenciales de `docker-compose.dev.yml`, y `turbo run build lint typecheck test`) + job `docker` que en cada PR construye (sin publicar) las imágenes de `apps/api` y `apps/web` como gate de que los Dockerfiles compilan, y en `main` las publica en GHCR con tag `sha` + `latest` (D-003, `permissions: packages: write`). Dockerfiles nuevos (no existían): `apps/api/Dockerfile` (multi-stage, `pnpm deploy --prod --legacy` para aislar `@awk/api` con solo deps de producción — ver D-013) y `apps/web/Dockerfile` (build Vite + `nginx:alpine` sirviendo estáticos con fallback SPA; el proxy real de `/api` sigue siendo el Nginx nativo del host, docs/03). `apps/api`, `packages/types` y `packages/auth` ahora declaran `"files": ["dist"]` (si no, `pnpm deploy`/`npm pack` excluyen `dist/` por estar en `.gitignore`). Ver D-013 para el patrón completo y los dos gotchas de pnpm 11 encontrados en la verificación local.

## En curso

- **Verificación local con BD** (Leonardo): Docker Desktop instalado; compose corregido para `postgres:18` (montaje en `/var/lib/postgresql`, convención 18+; si hay volumen viejo de la 16, `down -v` antes de `up`). Falta confirmar: Postgres arriba → `prisma:generate` → `prisma:migrate` (sin drift contra `core_init`) → `prisma:seed` → dev-login end-to-end en :5173.

## Siguiente (en orden)

1. Terminar la verificación local con BD (ver "En curso" y receta abajo).
2. **Abrir un PR de prueba y confirmar CI en verde** — no se pudo verificar en sandbox (sin Docker, sin Postgres real; ver "Resuelto recientemente" y D-013 para lo que sí se verificó). Revisar en especial: (a) el paso `prisma migrate deploy` contra el Postgres 18 de servicio, (b) que el job `docker` efectivamente construya ambas imágenes, (c) que el repo tenga habilitado `packages: write` para `GITHUB_TOKEN` (Settings → Actions → General) para que el push a GHCR en `main` no falle por permisos.
3. Provisionar infra (Lightsail, managed PG). **Runbook de la managed PostgreSQL listo**: `docs/runbooks/lightsail-postgres.md` (paso a paso por consola; plan Standard $30 2GB/80GB cifrado verificado en precios AWS 2026-07-11; versión **PG 18** — D-012, Lightsail ofrece hasta 18.4, corregido el 16 inicial). Antes de ejecutar, confirmar la **región del grupo** (RGPD→UE, es irreversible sin migración).
4. Primer módulo ejemplar construido a mano (elegir prototipo real sencillo) → plantilla de módulo.

### Receta de verificación local (paso 1)

```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres 18 en :5432
pnpm install    # relinkea node_modules (el sandbox lo dejó apuntando a un store propio; aceptar purge si pregunta)
cd apps/api
cp .env.example .env
pnpm prisma:generate                              # aquí sí descarga engines reales
pnpm prisma:migrate                               # aplica core_init; NO debe reportar drift (la migración se escribió a mano, ver nota abajo)
pnpm prisma:seed
cd ../.. && pnpm dev                              # api :3000 + web :5173
# entrar en http://localhost:5173 con leonardo.barreto@awakelab.dev (admin) o demo@awakelab.dev (user)
```

Si `prisma migrate dev` reportara drift contra `core_init`: regenerar la migración con `prisma migrate dev --name core_init` sobre BD limpia y commitear la versión generada.

## Notas de CI/Docker con pnpm 11 (monorepo) — válidas para todo Dockerfile o workflow futuro

- **Usar `pnpm exec turbo run ...`, nunca el atajo `pnpm turbo run ...`.** Reproducido tanto en sandbox como en una copia limpia del repo (no es un artefacto del sandbox): `pnpm turbo` dispara el chequeo de deps de pnpm 11 antes de ejecutar, y en este repo ese chequeo termina reinstalando en modo `--production` a mitad de la corrida — borra `devDependencies` (turbo incluido) y la tarea falla con `Command "turbo" not found`. `pnpm exec turbo` no pasa por ese chequeo. Ya corregido en `ci.yml` y en ambos Dockerfiles.
- **`pnpm deploy` para aislar un paquete (p. ej. `@awk/api`) requiere `--legacy`** en este workspace (no tenemos `inject-workspace-packages: true` en `pnpm-workspace.yaml`, y no hace falta configurarlo — sin `--legacy` falla con `ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE`). Ver D-013.
- **`pnpm deploy`/`npm pack` excluyen `dist/` por defecto** si el paquete no declara `"files"` en su `package.json`, porque sin `.npmignore` caen al `.gitignore` de la raíz (que sí ignora `dist/`). Por eso `apps/api`, `packages/types` y `packages/auth` ahora declaran `"files": ["dist"]`.
- **`nest build` no aplana a `dist/main.js`**: como no hay `rootDir` en `tsconfig.build.json` (incluye `src` y `prisma` como hermanos), el compilado real queda en `dist/src/main.js`. El script `start` de `apps/api` apuntaba a `dist/main.js` (bug preexistente, nunca ejercitado porque solo se corría `nest start --watch` en dev) — corregido a `dist/src/main.js`, igual que el `CMD` del Dockerfile.
- **No verificado en sandbox** (sin Docker instalado, sin Postgres real disponible): `docker build` de ambos Dockerfiles y `prisma migrate deploy` contra un Postgres real. Sí se verificó exhaustivamente todo lo demás en una copia limpia del repo: `pnpm install`, `pnpm exec turbo run build lint typecheck test` (19/19 tareas verdes) y el propio `pnpm deploy --legacy` de `@awk/api` arrancando de punta a punta (`node dist/src/main.js` levantó Nest y sirvió rutas). Primer PR real es quien debe confirmar el resto.

## Notas para el sandbox de Cowork (válidas para toda tarea futura)

- `pnpm` no está: instalarlo con `corepack enable --install-directory /tmp/bin` (con `COREPACK_HOME=/tmp/corepack`); `npm i -g` no puede escribir en /usr/bin.
- `binaries.prisma.sh` está bloqueado por allowlist. `prisma generate` funciona apuntando `PRISMA_SCHEMA_ENGINE_BINARY` a un script dummy (`printf '#!/bin/sh\nexit 0\n'`, +x): el generador `prisma-client` valida por WASM y no ejecuta el engine. `prisma migrate` NO funciona en sandbox → migraciones a mano (como `core_init`) y verificación en local.
- El `node_modules` del repo quedó linkeado al store del propio repo (`.pnpm-store/`, gitignored): las tareas de sandbox instalan con `pnpm install --store-dir "$PWD/.pnpm-store"` (rápido: el store persiste en el repo). En el Mac local, `pnpm install` normal relinkea.
- turbo 2 corre en strict env: las vars extra (p. ej. `PRISMA_*`) pasan por `globalPassThroughEnv` en `turbo.json` (ya configurado).
- Los procesos en background mueren entre llamadas del sandbox: usar comandos foreground con `timeout` (pnpm install es reanudable).

## Bloqueos / pendientes de decisión

- Elección del prototipo real que servirá de módulo ejemplar.
- IdP para SSO: ¿el grupo usa Microsoft 365/Entra ID? (condiciona Keycloak vs Entra). El dev-login actual queda encapsulado en AuthService: al llegar el IdP solo se sustituye ese método.
- **Seguridad**: rotar la contraseña de MongoDB expuesta en el historial de git (`backend/.env`, IP pública 84.247.191.200) y restringir ese Mongo a red privada si sigue en uso.

## Resuelto recientemente

- **CI GitHub Actions + Dockerfiles** (esta sesión): ver "Hecho" y D-013.
- Bug preexistente en `apps/api/package.json`: script `start` apuntaba a `dist/main.js`, que nunca existió (el compilado real es `dist/src/main.js`, ver notas de CI/Docker arriba). Corregido.
- `pnpm prisma:generate` verificado (bloqueo de la sesión anterior): con el generador nuevo de Prisma 7 funciona incluso en sandbox (ver notas).
- Core mínimo completo (esta sesión). `package-lock.json` residual de la raíz eliminado.
- **PG 16 → PG 18 (D-012)**: la elección inicial de 16 venía de un supuesto no verificado y docs de AWS desactualizadas; la consola de Lightsail ofrece hasta 18.4. Compose, runbook y CI sugerido actualizados a 18.
- Locks huérfanos de git (`index.lock`, `HEAD.lock`) limpiados tras crash de una sesión paralela; si un commit falla con "index.lock exists", verificar que no haya git vivo y borrarlos.
