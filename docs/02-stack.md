# 02 · Stack estándar

Un solo lenguaje (TypeScript) en toda la cadena: menos contexto para los prompts, tipos compartidos entre frontend y backend, y tu equipo ya lo domina.

## Decisiones

| Capa | Elección | Por qué (con foco en generación por IA) |
|---|---|---|
| Lenguaje | **TypeScript** (strict) en todo | El compilador es el primer revisor gratuito del código generado. Tipos compartidos front↔back eliminan una clase entera de bugs de integración. |
| Frontend | **React 18 + Vite** (SPA shell) | Ya es vuestra base. No se recomienda Next.js: SSR/RSC añade complejidad sin beneficio para apps internas tras login, y complica el deploy en VPS propio. |
| UI | **Tailwind CSS + shadcn/ui** con tokens de marca Awakelab (Poppins, paleta cian/azul 2026) | shadcn/ui son componentes que viven en tu repo (no dependencia opaca): Claude los ve, los extiende y mantiene consistencia visual total entre módulos. Es hoy la librería que mejor generan los LLMs. |
| API | **NestJS** | Es la elección más deliberada: su estructura rígida module/controller/service/DTO es exactamente lo que necesita un generador — cada módulo de negocio queda idéntico en forma. Fastify/Express dan más libertad, y la libertad aquí es el enemigo. |
| Validación/contratos | **Zod** + OpenAPI autogenerado | Un solo esquema define validación runtime, tipos TS y documentación de API. |
| ORM | **Prisma** | `schema.prisma` es una descripción declarativa y legible del modelo de datos: ideal como artefacto que el gerente/revisor puede entender y que la IA genera sin ambigüedad. Migraciones versionadas y verificables en CI. |
| Base de datos | **PostgreSQL 16** | Ver justificación abajo. |
| Monorepo | **pnpm workspaces + Turborepo** | `apps/web`, `apps/api`, `apps/factory` (control plane), `packages/ui`, `packages/types`, `packages/auth`. Un cambio = una PR = un pipeline. |
| Testing | **Vitest** + Supertest (API) + Playwright (e2e smoke) | La fábrica genera tests junto al código; CI los ejecuta como gate. |
| Calidad | ESLint + Prettier + reglas custom (p. ej. prohibir queries cross-schema sin permiso) | Lint como política de arquitectura ejecutable. |

## PostgreSQL vs MongoDB — la pregunta de fondo

Tu intuición es correcta y merece ser explícita: **para una fábrica de código con IA, el rigor relacional es una ventaja, no una fricción.**

- **La spec necesita un contrato verificable.** Un esquema relacional con FKs, constraints y tipos es una especificación que se valida sola: si la generación produce un modelo incoherente, la migración falla en CI antes de llegar a nadie. Con documentos flexibles, la incoherencia se descubre en producción.
- **La unificación entre módulos exige relaciones.** El punto 2 de tus problemas (procesos duplicados) se resuelve compartiendo entidades core (usuarios, empresas, cursos, alumnos). Eso es exactamente un modelo relacional con esquemas por módulo referenciando un esquema `core`.
- **Los datos sensibles exigen control granular.** Postgres ofrece Row-Level Security y permisos por esquema/tabla: la clasificación de datos de la spec se traduce en políticas ejecutables ([05](05-gobernanza-seguridad.md)).
- **La flexibilidad no se pierde**: `jsonb` cubre los casos genuinamente documentales (respuestas de formularios variables, configuraciones) dentro del mismo motor.

MongoDB queda descartado como estándar (el control plane actual en Mongo se migra; ver [06](06-roadmap.md)).

## Estructura de un módulo generado

Cada prototipo convertido produce exactamente esta forma — la plantilla es parte del repo y es lo que la fábrica rellena:

```
apps/api/src/modules/<modulo>/     # NestJS: controller, service, DTOs (Zod), tests
apps/web/src/modules/<modulo>/     # Rutas React, páginas, componentes (sobre packages/ui)
prisma/schema/<modulo>.prisma      # Modelos en el schema PG del módulo
apps/api/src/modules/<modulo>/module.manifest.ts  # nombre, roles, permisos, clasificación de datos, navegación
```

El `module.manifest.ts` es el contrato con la plataforma: el shell construye el menú y aplica RBAC leyendo los manifests, sin tocar código del core.
