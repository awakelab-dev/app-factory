# AwkFactory — Contexto base (leer siempre)

Plataforma modular corporativa + fábrica que convierte prototipos de Cowork (hechos por gerentes) en módulos de producción. Propietario: Leonardo (CTO Awakelab). Trabaja solo en esta fase; el trabajo se divide en muchas tareas/conversaciones independientes de Cowork — **este archivo y los docs son la única memoria compartida fiable entre tareas**.

## Protocolo de sesión (obligatorio)

1. **Al iniciar**: leer `docs/STATUS.md` (estado actual, qué está en curso, próximos pasos). Si la tarea toca arquitectura/stack/infra, leer también el doc relevante de `docs/`.
2. **Durante**: respetar las decisiones de `docs/DECISIONES.md`. Si una tarea necesita contradecir una decisión, proponerlo explícitamente a Leonardo antes de implementar.
3. **Al terminar**: actualizar `docs/STATUS.md` (siempre) y añadir entrada en `docs/DECISIONES.md` (solo si hubo decisión estructural nueva). Commit con mensaje `[tipo] descripción` (tipos: core, module, factory, docs, infra, fix).

## Fuente de verdad

| Archivo | Contenido |
|---|---|
| `docs/STATUS.md` | Estado vivo del proyecto: fase, hecho, en curso, siguiente. **Actualizar al cerrar cada sesión.** |
| `docs/DECISIONES.md` | Log append-only de decisiones estructurales. Nunca editar entradas pasadas. |
| `docs/01..06-*.md` | Estrategia, stack, arquitectura, integración Cowork, gobernanza, roadmap. |
| `docs/07-metodo-de-trabajo.md` | Cómo se trabaja con Claude en este proyecto (tipos de tarea, modelos). |

## Decisiones clave (resumen mínimo — detalle en docs/)

- Stack: 100% TypeScript. React+Vite, Tailwind+shadcn/ui (marca Awakelab 2026: Poppins, cianes/azules), NestJS, PostgreSQL+Prisma, monorepo pnpm+Turborepo.
- Infra: AWS Lightsail 32GB (red privada del grupo), Docker Compose sin PaaS, Nginx nativo, GitHub Actions→GHCR. BD: Lightsail managed PostgreSQL $30 (cifrado, modo privado). No Aurora. No MongoDB.
- Cada prototipo → un módulo de la plataforma (nunca app standalone). Pipeline con spec intermedia y gates humanos.
- `legacy/` contiene el prototipo original (Express+Mongo+React): **referencia conceptual, no base de código**. Su dashboard se reconstruye en Fase 1; después `legacy/` se elimina. No modificarlo ni instalarle dependencias.

## Estilo de trabajo con Leonardo

- Es CTO técnico: hablar sin rodeos, con trade-offs y recomendación clara. Español.
- Conciso. Prefiere decisiones argumentadas sobre menús de opciones interminables.
- Sensible a costos (infra y consumo de API): proponer siempre la opción eficiente.
