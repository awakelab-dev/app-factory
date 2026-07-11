# STATUS — Estado vivo del proyecto

> Actualizar al cerrar CADA sesión de trabajo. Este archivo es lo primero que lee cualquier tarea nueva.

**Última actualización**: 2026-07-11
**Fase actual**: Fase 0 — Fundaciones (monorepo creado; siguiente: core mínimo)

## Hecho

- Estrategia completa documentada y aprobada (`docs/01..06`).
- Infraestructura decidida: Lightsail 32GB + Lightsail managed PostgreSQL $30 (ver DECISIONES D-001..D-004).
- Sistema de trabajo por tareas definido (`docs/07-metodo-de-trabajo.md`).
- Prototipo original movido a `legacy/` (D-008).
- **Monorepo pnpm+Turborepo creado y verde** (2026-07-11): `apps/web` (React 19 + Vite 8 + Tailwind v4 con tokens de marca AWK-2026), `apps/api` (NestJS 11 + Prisma 7, endpoint `GET /api/hello`), `packages/types` (contratos Zod, tsup dual ESM/CJS), `packages/auth` (stub JWT/roles), `packages/ui` (tokens + Button estilo shadcn). Hello world tipado end-to-end verificado (el mismo schema Zod valida en API y en web). `pnpm install/build/test/lint/typecheck` pasan en limpio. Convenciones en D-009.
  - Notas técnicas: TypeScript fijado en `~5.9.3` (TS 7 nativo aún sin `emitDecoratorMetadata`); pnpm 11 usa `allowBuilds` en `pnpm-workspace.yaml`; tests de api con Vitest+SWC (`vitest.config.mts`); Prisma 7 no carga `.env` solo — la URL CLI vive en `apps/api/prisma.config.ts`; el schema Prisma aún no tiene modelos (llegan con el core). `prisma generate/validate` no pudo verificarse en el sandbox (binarios bloqueados): comprobar en local al arrancar el core.

## En curso

- Nada en curso.

## Siguiente (en orden)

1. **Core mínimo** en `apps/api` + `apps/web`: modelos Prisma del schema `core` (usuarios, roles, auditoría), auth real detrás del stub de `packages/auth`, RBAC básico y primer `module.manifest.ts` de ejemplo para que el shell construya menú/rutas.
2. Provisionar infra (Lightsail, managed PG, CI GitHub Actions con build+test+migración en BD efímera) — puede ir en paralelo.
3. Primer módulo ejemplar construido a mano (elegir prototipo real sencillo) → plantilla de módulo.

### Mensaje inicial sugerido para la próxima tarea (copiar/pegar)

> Modelo recomendado: Fable u Opus (fija el modelo de datos del core y el patrón RBAC).

```
[core] Core mínimo: modelos core + auth + RBAC + manifest

Objetivo: sobre el monorepo existente, añadir en apps/api el schema PG "core"
(usuarios, roles, auditoría) con Prisma 7 + migración inicial, un AuthModule que
implemente los contratos de packages/auth (dev-login mientras no hay IdP, ver
bloqueo IdP en STATUS), guard RBAC, y un module.manifest.ts de ejemplo que
apps/web lea para construir menú y rutas. Antes de empezar: verificar
`pnpm prisma:generate` en local (no se pudo en sandbox).
Terminado cuando: build+test+lint+typecheck verdes, migración aplica en un
Postgres local de Docker, y STATUS.md actualizado.
```

## Bloqueos / pendientes de decisión

- Elección del prototipo real que servirá de módulo ejemplar.
- IdP para SSO: ¿el grupo usa Microsoft 365/Entra ID? (condiciona Keycloak vs Entra)
- **Seguridad**: rotar la contraseña de MongoDB expuesta en el historial de git (`backend/.env`, IP pública 84.247.191.200) y restringir ese Mongo a red privada si sigue en uso.

## Resuelto recientemente

- Monorepo creado en este repo y verificado end-to-end (esta sesión). Carpeta residual `frontend/` eliminada del tracking.
