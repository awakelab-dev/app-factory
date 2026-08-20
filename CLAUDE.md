# AwkFactory — Contexto base (leer siempre)

Plataforma modular corporativa + fábrica que convierte prototipos de Cowork (hechos por gerentes) en módulos de producción. Propietario: Leonardo (CTO Awakelab). Trabaja solo en esta fase; el trabajo se divide en muchas tareas/conversaciones independientes de Cowork — **este archivo y los docs son la única memoria compartida fiable entre tareas**.

## Protocolo de sesión (obligatorio)

1. **Al iniciar**: leer `docs/STATUS.md` (estado actual, qué está en curso, próximos pasos). Si la tarea toca arquitectura/stack/infra, leer también el doc relevante de `docs/`.
2. **Durante**: respetar las decisiones de `docs/DECISIONES.md`. Si una tarea necesita contradecir una decisión, proponerlo explícitamente a Leonardo antes de implementar.
3. **Al terminar**: actualizar `docs/STATUS.md` (siempre) y añadir entrada en `docs/DECISIONES.md` (solo si hubo decisión estructural nueva). Commit con mensaje `[tipo] descripción` (tipos: core, module, factory, docs, infra, fix).
4. **Al terminar, ANTES de cerrar**: reescribir la sección **`## Para ejecutar AHORA (copiar y pegar)`** de `docs/STATUS.md` con lo que le queda por hacer a Leonardo. Ver la regla de abajo — es obligatoria, no opcional.

## Cómo se le dan instrucciones a Leonardo (REGLA DURA)

**Todo lo que Leonardo tenga que ejecutar se entrega como pasos numerados de copiar y pegar, nunca como prosa descriptiva.** Explicar "el job de staging corre `migrate.sh` entre `pull` y `up -d`" le obliga a reconstruir el comando, buscar la ruta, revisar histórico y leer documentación: eso es trabajo que la tarea no hizo. La prosa sirve para justificar decisiones; **para actuar, comandos**.

Cada paso lleva, en este orden:

1. **Qué consigue** en una línea.
2. **El bloque exacto** a pegar: un solo `bash` ejecutable desde la raíz del repo, con rutas absolutas o relativas a esa raíz, sin `<placeholders>` salvo que sea imposible evitarlos — y si lo son, con el comando que saca ese valor justo encima.
3. **Qué se espera ver** si salió bien (una línea de salida concreta, no "debería funcionar").
4. **Qué hacer si falla**, cuando el fallo sea previsible.

Reglas asociadas:

- **Un comando por paso.** Si hay que encadenar, `&&` dentro del mismo bloque, no dos bloques.
- **Nada de "abre el archivo y busca…"**: dar el `grep`, el `sed` o el archivo completo a reemplazar.
- **Archivos que el bridge no puede escribir** (`.github/workflows/*`): entregar el archivo COMPLETO y el `cp` que lo pone en su sitio desde `~/Downloads`, no un fragmento a insertar a mano.
- **Verificación incluida**: cada paso que cambia algo lleva su comprobación en el paso siguiente.
- La sección `## Para ejecutar AHORA (copiar y pegar)` de `docs/STATUS.md` es la única fuente de "qué toca hacer": si está vacía, no hay nada pendiente de manos humanas.

## Fuente de verdad

| Archivo | Contenido |
|---|---|
| `docs/STATUS.md` | Estado vivo del proyecto: fase, hecho, en curso, siguiente. **Actualizar al cerrar cada sesión**, incluida la sección `Para ejecutar AHORA`. |
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
- **Su tiempo es el recurso escaso**: no le hagas buscar un comando que la tarea ya sabía. Ver la regla dura de arriba.
