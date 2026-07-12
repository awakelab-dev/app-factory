# STATUS — Estado vivo del proyecto

> Actualizar al cerrar CADA sesión de trabajo. Este archivo es lo primero que lee cualquier tarea nueva.

**Última actualización**: 2026-07-12 (sesión infra: artefactos de deploy staging+production listos — D-016; **pendiente que Leonardo ejecute el runbook en el server real**, el sandbox de Cowork no tiene ruta de red al Lightsail)
**Fase actual**: Fase 0 — Fundaciones (core mínimo + CI en verde; managed PostgreSQL y Docker listos; deploy diseñado y con artefactos listos, ejecución manual pendiente)

## Hecho

- Estrategia completa documentada y aprobada (`docs/01..06`).
- Infraestructura decidida: Lightsail 32GB + Lightsail managed PostgreSQL $30 (ver DECISIONES D-001..D-004).
- Sistema de trabajo por tareas definido (`docs/07-metodo-de-trabajo.md`).
- Prototipo original movido a `legacy/` (D-008).
- Monorepo pnpm+Turborepo verde con hello world tipado end-to-end (D-009).
- **Core mínimo** (2026-07-11): modelos Prisma del schema PG `core` (`users`, `roles`, `user_roles`, `audit_events`) con migración inicial `core_init` + seed idempotente (roles admin/user, usuarios dev `leonardo.barreto@awakelab.dev`=admin y `demo@awakelab.dev`=user); **auth**: `POST /api/auth/dev-login` (solo email contra usuarios sembrados, deshabilitado con `NODE_ENV=production`) emite JWT HS256 de plataforma, `GET /api/auth/me`; **RBAC**: guards globales `JwtAuthGuard`+`RolesGuard` con decoradores `@Public()`/`@Roles()` y la regla `canAccess` de `@awk/auth` compartida api↔web; **auditoría**: `AuditService` global (append-only, nunca tumba la operación); **manifests**: `moduleManifestSchema` en `@awk/types`, módulos de ejemplo `hello` y `core-admin` (`GET /api/core/users` solo admin) — el shell web construye menú y rutas desde los manifests filtrando por roles, con login dev y sesión en localStorage. Migración a Prisma 7 real: generador `prisma-client` sin engines Rust + adapter pg (D-010); patrón auth/RBAC/manifest fijado (D-011). `turbo build/test/lint/typecheck` verdes y smoke test de la API sin BD (hello 200, me 401, zod 400).
- **CI GitHub Actions + Dockerfiles** (2026-07-11, **confirmada en verde en GitHub el 2026-07-12**): `.github/workflows/ci.yml` — job `build-test` (pnpm install, `prisma migrate deploy` contra Postgres 18 de servicio efímero con las credenciales de `docker-compose.dev.yml`, y `turbo run build lint typecheck test`) + jobs `Docker api` / `Docker web` que en cada PR construyen (sin publicar) las imágenes de `apps/api` y `apps/web` como gate de que los Dockerfiles compilan, y en `main` las publican en GHCR con tag `sha` + `latest` (D-003, `permissions: packages: write`). Los tres jobs corrieron verdes en el primer push real a `main` (repo `awakelab-dev/app-factory`). Dockerfiles nuevos (no existían): `apps/api/Dockerfile` (multi-stage, `pnpm deploy --prod --legacy` para aislar `@awk/api` con solo deps de producción — ver D-013) y `apps/web/Dockerfile` (build Vite + `nginx:alpine` sirviendo estáticos con fallback SPA; el proxy real de `/api` sigue siendo el Nginx nativo del host, docs/03). `apps/api`, `packages/types` y `packages/auth` declaran `"files": ["dist"]` (si no, `pnpm deploy`/`npm pack` excluyen `dist/` por estar en `.gitignore`). Ver D-013 para el patrón completo y los dos gotchas de pnpm 11 encontrados en la verificación local.

- **Lightsail managed PostgreSQL provisionada** (2026-07-12, ejecuta D-004 vía `docs/runbooks/lightsail-postgres.md`): instancia PG **18.4** en `eu-west-3` (París, UE), plan Standard $30 (2GB/80GB, **cifrado en reposo**), **modo privado** (solo recursos Lightsail de la región). Usuario maestro `dbmasteruser`; base inicial por defecto `dbmaster` (sin uso). Bases lógicas por entorno creadas: `awkplatform_staging` y `awkplatform_production`. **Point-in-time restore verificado** (Emergency restore → instancia temporal contenía ambas bases → borrada). Endpoint privado `ls-....eu-west-3.rds.amazonaws.com:5432`. **Pendiente antes del deploy**: crear roles de app de mínimo privilegio `app_staging`/`app_production` y guardar las dos `DATABASE_URL` como secreto (SSM/gestor), fuera del repo. La API lee `process.env.DATABASE_URL` (CLI en `prisma.config.ts`, runtime en `prisma.service.ts`); el dev local sigue apuntando al Postgres de Docker, no a la managed. Como la BD es privada, la primera `prisma migrate deploy`+seed contra staging/prod corre **desde el Lightsail de 32 GB o CI**, nunca desde portátil.

- **Docker en el Lightsail de cómputo** (2026-07-12, D-015): Engine 29.6.1 + Compose v2 (`docker compose`, v5.3.1) instalados desde el repo oficial; usuario `ubuntu` en el grupo `docker`. El server (existente/compartido, ver memoria) ya está listo para levantar compose sin tocar Nginx/certbot/pm2.
- **Artefactos de deploy staging+production** (2026-07-12, D-016): `deploy/docker-compose.yml` (único, sin secretos) + `deploy/staging.env.example` / `deploy/production.env.example` + `deploy/nginx/{staging,production}.conf` para los dominios reales `staging.factory.wiloxagency.com` / `production.factory.wiloxagency.com`, puertos tentativos 18100-18103; `apps/api/Dockerfile` con nuevo stage `migrator` + job `docker-migrator` en `ci.yml` que publica `awkplatform-api-migrator` en GHCR (permite `prisma migrate deploy`/seed contra la managed sin instalar Node/pnpm en el host); `deploy/scripts/migrate.sh` para correrlo; `.github/workflows/deploy.yml` (staging automático tras CI verde en `main`, producción por promoción manual `workflow_dispatch`); runbook completo en `docs/runbooks/lightsail-deploy.md`. Llave SSH dedicada `awk-deploy` generada (no reutiliza ninguna personal), pública entregada para autorizar en el server, privada para el GitHub Secret `LIGHTSAIL_SSH_KEY`. **No ejecutado aún contra el server real**: el sandbox de Cowork no tiene ruta de red al Lightsail (`13.38.161.213:22` → `Network is unreachable`, confirmado). Pendiente que Leonardo corra el runbook (o pegue la llave/curse los pasos) para que quede realmente sirviendo por HTTPS.

## En curso

Ejecución del runbook `docs/runbooks/lightsail-deploy.md` en el Lightsail real (fuera del alcance del sandbox de Cowork). Ver checklist de verificación al final de ese runbook — cerrar esta entrada cuando esté todo ✅.

## Siguiente (en orden)

1. **Terminar el deploy**: Leonardo ejecuta `docs/runbooks/lightsail-deploy.md` paso a paso (autorizar llave, confirmar puertos, roles de BD, primer `up`+migración, Nginx/certbot, GitHub Secrets). Si algo se desvía (puertos ocupados, PAT de GHCR ya existente con otro alcance, DNS no propagado) documentarlo ahí mismo y en D-016 si cambia una decisión.
2. Primer módulo ejemplar construido a mano (elegir prototipo real sencillo) → plantilla de módulo.
3. (Opcional, no bloqueante) Rotar la contraseña de MongoDB expuesta en `backend/.env` en el historial de git y evaluar purgarla con `git-filter-repo` (ver "Bloqueos").

### Mensaje inicial sugerido para la próxima tarea (copiar/pegar)

> Modelo recomendado: Sonnet. Si el runbook de deploy ya se ejecutó y verificó
> en el server real, arrancar con la tarea 2 (primer módulo ejemplar).

```
[infra] Verificar/cerrar el deploy de staging+production en el Lightsail

Objetivo: confirmar que docs/runbooks/lightsail-deploy.md (D-016) quedó
ejecutado correctamente en el Lightsail real y cerrar la checklist final de
ese runbook. Si algo falló a mitad (puertos, DNS, GHCR), resolverlo y dejar
documentado el desvío en el propio runbook y/o una decisión nueva en
DECISIONES.md.

Antes de empezar: leer docs/STATUS.md, docs/runbooks/lightsail-deploy.md y
D-016 completo.
Terminado cuando: staging y production sirven por HTTPS en sus dominios
reales, dev-login funciona contra la managed en ambos, el deploy automático
(push a main → Deploy → staging) corrió al menos una vez en verde, y
STATUS.md actualizado con el resultado real (no el plan).
```

### Receta de verificación local con BD (ya completada — queda de referencia para levantar el entorno de nuevo)

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
- Lo no verificable en sandbox (sin Docker, sin Postgres real: `docker build` de ambos Dockerfiles y `prisma migrate deploy` contra un Postgres real) quedó confirmado en GitHub Actions el 2026-07-12: los tres jobs (`build · lint · typecheck · test`, `Docker api`, `Docker web`) corrieron verdes en el primer push a `main`, con publicación a GHCR incluida. Lo verificado antes en sandbox (copia limpia del repo: `pnpm install`, `pnpm exec turbo run build lint typecheck test` 19/19 verdes, `pnpm deploy --legacy` de `@awk/api` arrancando de punta a punta) más esta confirmación en GitHub cubren todo el pipeline.

## Notas para el sandbox de Cowork (válidas para toda tarea futura)

- `pnpm` no está: instalarlo con `corepack enable --install-directory /tmp/bin` (con `COREPACK_HOME=/tmp/corepack`); `npm i -g` no puede escribir en /usr/bin.
- `binaries.prisma.sh` está bloqueado por allowlist. `prisma generate` funciona apuntando `PRISMA_SCHEMA_ENGINE_BINARY` a un script dummy (`printf '#!/bin/sh\nexit 0\n'`, +x): el generador `prisma-client` valida por WASM y no ejecuta el engine. `prisma migrate` NO funciona en sandbox → migraciones a mano (como `core_init`) y verificación en local.
- El `node_modules` del repo quedó linkeado al store del propio repo (`.pnpm-store/`, gitignored): las tareas de sandbox instalan con `pnpm install --store-dir "$PWD/.pnpm-store"` (rápido: el store persiste en el repo). En el Mac local, `pnpm install` normal relinkea.
- turbo 2 corre en strict env: las vars extra (p. ej. `PRISMA_*`) pasan por `globalPassThroughEnv` en `turbo.json` (ya configurado).
- Los procesos en background mueren entre llamadas del sandbox: usar comandos foreground con `timeout` (pnpm install es reanudable).

## Bloqueos / pendientes de decisión

- Elección del prototipo real que servirá de módulo ejemplar.
- IdP para SSO: ¿el grupo usa Microsoft 365/Entra ID? (condiciona Keycloak vs Entra). El dev-login actual queda encapsulado en AuthService: al llegar el IdP solo se sustituye ese método.
- **Seguridad**: rotar la contraseña de MongoDB expuesta en el historial de git (`backend/.env`, IP pública 84.247.191.200) y restringir ese Mongo a red privada si sigue en uso. Sigue en el historial después de la purga de D-014 (esa purga solo sacó `node_modules` y `uploads`, no tocó `.env`); rotar la contraseña primero, y de paso evaluar si conviene purgar también `backend/.env` con `git-filter-repo` (ya instalado y probado esta sesión) ya que el repo remoto sigue sin nada publicado.

## Resuelto recientemente

- **CI en verde en GitHub Actions (primer push real a `main`)**: los tres jobs de `ci.yml` (`build · lint · typecheck · test`, `Docker api`, `Docker web`) corrieron y pasaron en `awakelab-dev/app-factory`, con publicación de ambas imágenes en GHCR (push habilitado solo en `main`). Cierra el ciclo de esta tarea de CI/Docker completo.
- **Push rechazado por GitHub (blob de 170MB) → historia reescrita (D-014)**: `git push -u origin main` desde la Mac falló con `pre-receive hook declined` por `backend/uploads/....zip` (170MB, > límite de 100MB de GitHub). Se instaló `git-filter-repo` (`pip install git-filter-repo --break-system-packages`, no viene con git) y se purgaron `backend/node_modules`, `frontend/node_modules` y `backend/uploads` de **todo** el historial (basura pre-D-008). `.git` bajó de 183MB a ~500KB, los 15 commits y sus mensajes quedaron intactos (solo cambian los hashes), y el `legacy/` actual (23 archivos) no se tocó. Como el remoto nunca había aceptado un push, no fue necesario force-push. Se hizo un backup de `.git` antes de reescribir (`/tmp/app-factory-git-backup-pre-filter-repo` en el sandbox, no persiste). Pendiente: repetir el push (ver "En curso").
- **Verificación local con BD terminada** (Leonardo, Docker Desktop): Postgres 18 arriba vía `docker-compose.dev.yml`, dev-login y lectura de usuarios funcionando end-to-end en :5173. (Nota aparte, no funcional: en Docker Desktop el contenedor aparece agrupado bajo el nombre del proyecto Compose "app-factory" sin ID/imagen/puerto visibles hasta expandir la fila — es la agrupación normal de Compose, no un problema.)
- **Remoto configurado + rama renombrada**: `origin` → `git@github.com:awakelab-dev/app-factory.git` (repo privado nuevo, vacío). La rama local era `master`; se renombró a `main` porque el workflow de CI dispara sobre `push: branches: [main]` — con `master` el job nunca hubiera corrido. El push en sí no se pudo hacer desde el sandbox de Cowork (sin acceso SSH/red a github.com); queda para la Mac de Leonardo (ver "En curso").
- **CI GitHub Actions + Dockerfiles** (esta sesión): ver "Hecho" y D-013.
- Bug preexistente en `apps/api/package.json`: script `start` apuntaba a `dist/main.js`, que nunca existió (el compilado real es `dist/src/main.js`, ver notas de CI/Docker arriba). Corregido.
- `pnpm prisma:generate` verificado (bloqueo de la sesión anterior): con el generador nuevo de Prisma 7 funciona incluso en sandbox (ver notas).
- Core mínimo completo (esta sesión). `package-lock.json` residual de la raíz eliminado.
- **PG 16 → PG 18 (D-012)**: la elección inicial de 16 venía de un supuesto no verificado y docs de AWS desactualizadas; la consola de Lightsail ofrece hasta 18.4. Compose, runbook y CI sugerido actualizados a 18.
- Locks huérfanos de git (`index.lock`, `HEAD.lock`) limpiados tras crash de una sesión paralela; si un commit falla con "index.lock exists", verificar que no haya git vivo y borrarlos.
