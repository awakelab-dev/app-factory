# STATUS — Estado vivo del proyecto

> Actualizar al cerrar CADA sesión de trabajo. Este archivo es lo primero que lee cualquier tarea nueva.

**Última actualización**: 2026-07-11 (sesión core mínimo)
**Fase actual**: Fase 0 — Fundaciones (core mínimo construido; pendiente verificación local con BD)

## Hecho

- Estrategia completa documentada y aprobada (`docs/01..06`).
- Infraestructura decidida: Lightsail 32GB + Lightsail managed PostgreSQL $30 (ver DECISIONES D-001..D-004).
- Sistema de trabajo por tareas definido (`docs/07-metodo-de-trabajo.md`).
- Prototipo original movido a `legacy/` (D-008).
- Monorepo pnpm+Turborepo verde con hello world tipado end-to-end (D-009).
- **Core mínimo** (2026-07-11): modelos Prisma del schema PG `core` (`users`, `roles`, `user_roles`, `audit_events`) con migración inicial `core_init` + seed idempotente (roles admin/user, usuarios dev `leonardo.barreto@awakelab.dev`=admin y `demo@awakelab.dev`=user); **auth**: `POST /api/auth/dev-login` (solo email contra usuarios sembrados, deshabilitado con `NODE_ENV=production`) emite JWT HS256 de plataforma, `GET /api/auth/me`; **RBAC**: guards globales `JwtAuthGuard`+`RolesGuard` con decoradores `@Public()`/`@Roles()` y la regla `canAccess` de `@awk/auth` compartida api↔web; **auditoría**: `AuditService` global (append-only, nunca tumba la operación); **manifests**: `moduleManifestSchema` en `@awk/types`, módulos de ejemplo `hello` y `core-admin` (`GET /api/core/users` solo admin) — el shell web construye menú y rutas desde los manifests filtrando por roles, con login dev y sesión en localStorage. Migración a Prisma 7 real: generador `prisma-client` sin engines Rust + adapter pg (D-010); patrón auth/RBAC/manifest fijado (D-011). `turbo build/test/lint/typecheck` verdes y smoke test de la API sin BD (hello 200, me 401, zod 400).

## En curso

- Nada en curso.

## Siguiente (en orden)

1. **Verificación local con BD** (Leonardo, ~10 min, ver receta abajo): migración + seed + dev-login end-to-end.
2. Provisionar infra (Lightsail, managed PG, CI GitHub Actions con build+test+migración en BD efímera).
3. Primer módulo ejemplar construido a mano (elegir prototipo real sencillo) → plantilla de módulo.

### Receta de verificación local (paso 1)

```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres 16 en :5432
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

### Mensaje inicial sugerido para la próxima tarea (copiar/pegar)

> Modelo recomendado: Sonnet (infra/CI es mecánico una vez decidido D-003/D-004).

```
[infra] CI GitHub Actions: build+test+lint+typecheck y migración en BD efímera

Objetivo: workflow de CI que en cada PR corra pnpm install, turbo
build/test/lint/typecheck y aplique las migraciones Prisma contra un Postgres
16 de servicio (BD efímera), y en main además construya imágenes Docker de
apps/api y apps/web y las publique en GHCR (D-003). Nota: en CI no aplican los
workarounds del sandbox de Cowork (ver "Notas sandbox" en STATUS); GitHub
Actions descarga engines de Prisma sin problema.
Terminado cuando: workflow verde en un PR de prueba y STATUS.md actualizado.
```

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

- `pnpm prisma:generate` verificado (bloqueo de la sesión anterior): con el generador nuevo de Prisma 7 funciona incluso en sandbox (ver notas).
- Core mínimo completo (esta sesión). `package-lock.json` residual de la raíz eliminado.
