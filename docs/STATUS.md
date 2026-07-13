# STATUS — Estado vivo del proyecto

> Actualizar al cerrar CADA sesión de trabajo. Este archivo es lo primero que lee cualquier tarea nueva.

**Última actualización**: 2026-07-13 (sesión infra: **deploy en producción verificado end-to-end** — D-016. Leonardo ejecutó el runbook a mano por SSH desde su Mac, con Claude guiando/depurando en vivo; el sandbox de Cowork nunca tuvo ruta de red al Lightsail)
**Fase actual**: Fase 0 — Fundaciones (core mínimo + CI en verde; managed PostgreSQL y Docker listos; **staging y production sirviendo por HTTPS en sus dominios reales, verificados**)

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
- **Deploy de staging+production en el Lightsail — VERIFICADO end-to-end** (2026-07-13, D-016, ejecutado por Leonardo por SSH desde su Mac con Claude guiando/depurando en vivo; el sandbox de Cowork nunca tuvo ruta de red al Lightsail — `13.38.161.213:22` → `Network is unreachable`, confirmado, así que no lo ejecutó Claude directamente):
  - `deploy/docker-compose.yml` (único, sin secretos, valores por `.env` fuera del repo en `/opt/awkfactory/<entorno>/.env`) + `deploy/nginx/{staging,production}.conf` sirviendo **staging.factory.wiloxagency.com** y **production.factory.wiloxagency.com** por HTTPS (certbot). Puertos confirmados libres: 18100/18101 (staging), 18102/18103 (production).
  - Roles `app_staging`/`app_production` con mínimo privilegio; migración `core_init` + seed aplicados en ambas bases vía la imagen auxiliar `awkplatform-api-migrator` (stage `migrator` de `apps/api/Dockerfile`, D-013) y `deploy/scripts/migrate.sh`.
  - `dev-login` verificado: 200 con JWT admin en staging; **403 "deshabilitado en producción"** en production (correcto por diseño, D-011 — solo el IdP lo habilitará ahí).
  - `.github/workflows/deploy.yml`: staging automático tras CI verde en `main`; producción por promoción manual `workflow_dispatch` (re-tag del sha ya validado en staging). **GitHub Secrets cableados y deploy automático confirmado en verde** (`LIGHTSAIL_HOST`/`LIGHTSAIL_SSH_USER`/`LIGHTSAIL_SSH_KEY`; la llave pública `awk-deploy` quedó autorizada en `~/.ssh/authorized_keys` del server — el primer intento falló por eso, `handshake failed`, y quedó resuelto).
  - **Bug crítico encontrado y corregido en el camino**: `apps/api/Dockerfile` quedó con el stage `migrator` *después* de `runtime`; sin `target:` explícito en `ci.yml`, Docker construye por defecto el *último* stage del archivo, así que el job `docker` publicó brevemente el contenido de `migrator` bajo el tag `awkplatform-api` → crash loop en producción (intentaba `prisma migrate deploy` en vez de levantar el servidor). Corregido añadiendo `target: runtime` explícito en `ci.yml` (aplica a ambos Dockerfiles, que ya tienen un stage llamado `runtime`). **Lección para cualquier Dockerfile futuro con stages auxiliares (D-016): declarar siempre `target:` explícito en CI, nunca depender del último stage del archivo.**
  - Otros bugs de una sola vez ya corregidos y documentados en `docs/runbooks/lightsail-deploy.md`/`lightsail-postgres.md`: `docker run --env-file` no interpreta comillas (rompía `DATABASE_URL`/`JWT_SECRET` citados); `GRANT ALL ON DATABASE` no alcanza el schema `public` donde Prisma pone `_prisma_migrations`; `pg`/`@prisma/adapter-pg` trata `sslmode=require` como `verify-full` y falla contra el cert de Lightsail (necesita `uselibpqcompat=true`); `pnpm exec` (no solo `pnpm turbo`) dispara el chequeo de deps de pnpm 11 y borra devDependencies sin TTY — usar binarios directos `node_modules/.bin/<bin>`.

## En curso

(nada abierto — deploy de D-016/D-017 cerrado por completo, incluido el deploy automático)

## Siguiente (en orden)

1. Primer módulo ejemplar construido a mano (elegir prototipo real sencillo) → plantilla de módulo.
2. (Opcional, no bloqueante) Rotar la contraseña de MongoDB expuesta en `backend/.env` en el historial de git y evaluar purgarla con `git-filter-repo` (ver "Bloqueos"). También considerar rotar el password de `app_staging`/`app_production` y los `JWT_SECRET`: quedaron pegados en texto plano en un chat de Cowork durante esta sesión (no se guardaron en memoria ni en el repo, pero el historial del chat los tiene).

### Mensaje inicial sugerido para la próxima tarea (copiar/pegar)

> Modelo recomendado: Sonnet para infra mecánica; Opus si el primer módulo
> ejemplar requiere diseño de dominio no trivial.

```
[factory] Primer módulo ejemplar construido a mano

Objetivo: elegir un prototipo real sencillo (ver legacy/ como referencia
conceptual, no como base de código, D-008) y construirlo a mano siguiendo
el patrón fijado en D-011 (auth/RBAC/manifest) para que sirva de plantilla
de módulo replicable por la fábrica.

Antes de empezar: leer docs/STATUS.md, docs/DECISIONES.md completo (D-001
a D-016) y docs/07-metodo-de-trabajo.md.
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
- **Ni siquiera `pnpm exec <cmd>` es seguro dentro de este workspace para comandos que no sean `turbo`**: reproducido en el Lightsail real (2026-07-12) corriendo `pnpm exec prisma migrate deploy` desde la imagen `migrator` (D-016) — dispara el mismo chequeo de deps de pnpm 11 (log: "Scope: all 6 workspace projects") y, con `CI=true`, termina reinstalando en modo `--production` y borrando `prisma`/`tsx` (devDependencies) justo antes de invocarlos (`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL: Command "prisma" not found`). Sin `CI=true` aborta distinto: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. La única forma confiable de invocar un binario de una devDependency en este workspace, en un contenedor no interactivo, es el binario directo — `node_modules/.bin/<bin>` — nunca `pnpm exec` ni `pnpm <script>`. Ver `apps/api/Dockerfile` stage `migrator` y `deploy/scripts/migrate.sh`.

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
