# STATUS — Estado vivo del proyecto

> Actualizar al cerrar CADA sesión de trabajo. Este archivo es lo primero que lee cualquier tarea nueva.

**Última actualización**: 2026-07-11
**Fase actual**: Fase 0 — Fundaciones (no iniciada en código; estrategia cerrada)

## Hecho

- Estrategia completa documentada y aprobada (`docs/01..06`).
- Infraestructura decidida: Lightsail 32GB + Lightsail managed PostgreSQL $30 (ver DECISIONES D-001..D-004).
- Sistema de trabajo por tareas definido (`docs/07-metodo-de-trabajo.md`), incluido cierre parcial de tareas inconclusas.
- Prototipo original movido a `legacy/` (D-008); repo limpio y listo para alojar el monorepo. `.gitignore` añadido.

## En curso

- Nada en curso.

## Siguiente (en orden)

1. Crear monorepo `pnpm + Turborepo` en este repo (estructura de `docs/02-stack.md`).
2. Core mínimo: NestJS + Prisma + auth stub, shell React con tokens de marca Awakelab.
3. Provisionar infra (Lightsail, managed PG, CI) — puede ir en paralelo.
4. Primer módulo ejemplar construido a mano (elegir prototipo real sencillo) → plantilla de módulo.

### Mensaje inicial sugerido para la próxima tarea (copiar/pegar)

> Modelo recomendado: Fable u Opus (decisión estructural: fija la forma del monorepo).

```
[core] Crear monorepo

Objetivo: montar el monorepo pnpm+Turborepo según docs/02-stack.md:
apps/web (React+Vite+Tailwind+shadcn con tokens de marca Awakelab),
apps/api (NestJS+Prisma), packages/ui, packages/types, packages/auth,
tooling base (ESLint, Prettier, Vitest, tsconfig estricto).
Terminado cuando: pnpm install + build + test pasan en limpio, hay un
"hello world" tipado end-to-end (web llama a api), y STATUS.md queda
actualizado con el siguiente paso.
```

## Bloqueos / pendientes de decisión

- Elección del prototipo real que servirá de módulo ejemplar.
- IdP para SSO: ¿el grupo usa Microsoft 365/Entra ID? (condiciona Keycloak vs Entra)
- **Seguridad**: rotar la contraseña de MongoDB expuesta en el historial de git (`backend/.env`, IP pública 84.247.191.200) y restringir ese Mongo a red privada si sigue en uso.

## Resuelto recientemente

- Monorepo: irá en ESTE repo (el prototipo se movió a `legacy/`, D-008).
