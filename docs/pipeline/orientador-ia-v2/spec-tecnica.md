# Spec técnica — `orientador-ia-v2`

> Artefacto del pipeline de Fase 1 (docs/04, paso 2). Para revisión técnica (docs/05) antes de generación. Depende de las decisiones funcionales (pendientes) en `spec-funcional.md`.

## Resultado del chequeo de antiduplicación (obligatorio, docs/04 `list_modules`)

**Match exacto.** El material fuente (`/Users/leonardobarreto/projects/orientadorIA`) es el mismo prototipo que ya generó el módulo de producción `orientador-ia`, hoy vivo en el monorepo:

| Pieza | Ya existe en | Estado |
|---|---|---|
| Backend | `apps/api/src/modules/orientador-ia/` (`orientador-ia.controller.ts`, `orientador-intake.service.ts`, `orientador-claude.service.ts`, `orientador-academies.service.ts`, `orientador-export.service.ts`, `orientador-query.service.ts`, `orientador-ia.mappers.ts`) | Construido, con tests (`.spec.ts`), en `main` |
| Frontend candidato | `apps/web/src/modules/orientador-ia/` (`OrientadorCandidatePage.tsx`, `MarketIntelPage.tsx`, `pdf-text-extract.ts`, `itinerary-pdf.ts`, `use-speech-to-text.ts`, tema Refactika) | Construido, con tests |
| Frontend admin | `OrientadorAdminPage.tsx` + `module.manifest.ts` (roles `orientador_admin`, `admin`) | Construido, con tests |
| Modelo de datos | `apps/api/prisma/schema.prisma`, schema `orientador`: `OrientadorLead` (`leads`), `OrientadorProfile` (`profiles`), `OrientadorAcademy` (`academies`), `OrientadorExportLog` (`exports_log`), enums `OrientadorInputType`/`OrientadorLevel` | Migrado |
| Endpoints | `POST /api/orientador-ia/intake` (`@Public()`), `GET .../academies` (`@Public()`), `GET .../admin/leads`, `GET .../admin/leads/export`, `GET .../admin/academies`, `PUT .../admin/academies/:id` (`@Roles('orientador_admin','admin')`) | Desplegados |
| Spec previa del pipeline | `docs/pipeline/orientador-ia/spec-funcional.md` + `spec-tecnica.md` | Gates funcional y técnico **APROBADOS** 2026-07-14 |
| Historial de decisiones | D-024, D-025, D-026, D-027, D-028 (ver `docs/DECISIONES.md`) | Cierran el ciclo completo intake → generación → verificación → deploy |

No hay ninguna entidad, endpoint, rol o integración en el prototipo fuente que no esté ya cubierto por este módulo. La diferencia entre "construir `orientador-ia-v2`" y "no hacer nada" es, con la información disponible hoy, **cero**.

## Por qué el gate es igualmente obligatorio (docs/05) aunque la recomendación sea no construir

Aplican varios criterios de docs/05 de forma simultánea, lo que hace la revisión técnica obligatoria pase lo que pase:

- **Datos personales/RGPD**: el dominio (nombre, email, teléfono, historia/CV) es el mismo que ya está clasificado como personal en `orientador-ia` — cualquier variante de este proyecto hereda esa clasificación.
- **Migración/duplicación de schema**: construir esto tal cual implicaría crear un segundo schema/módulo (`orientador_v2` o similar) redundante con `orientador`, o forzar una migración sobre tablas de un módulo ya existente — ambos casos están explícitamente cubiertos por "la migración toca el schema... de otro módulo".
- **Alcance ambiguo señalado por el propio análisis**: no hay declaración de qué cambia respecto al original; docs/05 exige revisión humana precisamente cuando el análisis detecta esto.
- **Dependencia externa ya en uso pero no trivial**: reutilizaría la integración con la API de Claude (costo variable) sin que quede claro si el límite de 50 ejecuciones/candidato y el modelo (Haiku) siguen vigentes para este caso o si habría que renegociarlos.

No aplica auto-aprobación por muestreo.

## Opciones técnicas para el gate (a decidir por el revisor/CTO, no por este análisis)

1. **Rechazar y archivar** `orientador-ia-v2` como duplicado — cero cambios de código, cero migraciones. Recomendado si esto era una validación deliberada del paso de antiduplicación del pipeline.
2. **Redirigir a `request_change`** sobre el módulo `orientador-ia` existente, una vez el solicitante describa el cambio concreto (p. ej. nuevo cliente además de Aspasia, contenido de academias distinto, un flujo adicional). Ese flujo reutiliza el mismo backend/frontend/schema y genera una mini-spec incremental — no un módulo nuevo.
3. **Si el objetivo real fuera multi-tenant** (Awakelab vendiendo el mismo módulo a un cliente distinto de Aspasia): esto es explícitamente una decisión de arquitectura posterior según la propia spec original (`docs/pipeline/orientador-ia/spec-funcional.md`, sección "Qué NO incluye"), no algo que este pipeline de creación de módulos deba resolver reconstruyendo el mismo prototipo.

Ninguna de estas opciones requiere generar modelos Prisma, endpoints o pantallas nuevos, por lo que esta spec técnica **no incluye una sección de diseño de generación** — sería prematura y duplicaría, palabra por palabra, `docs/pipeline/orientador-ia/spec-tecnica.md`.

## Gate técnico — pendiente

No aprobado. Requiere que el revisor técnico / CTO elija una de las tres opciones anteriores antes de que este proyecto pueda avanzar al paso 4 (GENERACIÓN) — y en las opciones 1 y 2, el paso 4 de este pipeline específico (`orientador-ia-v2`) nunca se ejecuta.
