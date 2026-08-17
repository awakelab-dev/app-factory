# Incremento D — «cero consola»: del prototipo al módulo vivo en staging

> Diseño validado con Leonardo el 2026-08-17 antes de escribir código (patrón D-036/D-047).
> **D1 está construido y verificado** (D-050). **D2 y D3 están diseñados y aprobados, sin construir.**
> Objetivo: que el ciclo prototipo → módulo funcionando **en staging** no exija una sola orden por
> terminal. Producción y Fase 3 (A2F) quedan fuera a propósito.

## 0. Los pasos manuales, y qué bloque mata cada uno

| Paso manual (estado en D-049) | Lo mata | Queda | Estado |
|---|---|---|---|
| Commit de integración: `app.module.ts` + `registry.ts` | B1 | nada | **hecho (D-050)** |
| `INSERT` de roles + `user_roles` por SQL | B2 | asignar roles **en la UI** | **hecho (D-050)** |
| `docker compose logs` por SSH para saber por qué no avanza | B5 | mirar `/factory` | **hecho (D-050)** |
| Escribir la migración a mano | B3 | revisar el `.sql` **en la PR** | pendiente (D2) |
| `~/migrate.sh staging latest` por SSH | B3b | nada | pendiente (D2) |
| `cli generate <specId>` en el Mac | B4 | nada | pendiente (D3) |
| Mergear la PR | B6 | **leer el diff** (gate `pr_review`, humano, admin) | pendiente (D3) |

Al cerrar D3 el humano hace exactamente tres cosas, todas fuera de la terminal: decidir gates en
`/factory` (o en el chat), **leer el diff de la PR**, y validar el módulo en staging. Eso último no se
toca: D-049 es la mejor prueba que tenemos de que el gate de PR debe seguir siendo humano.

## Fases

| Fase | Bloques | Infra nueva | Estado |
|---|---|---|---|
| **D1** | 1 (cableado) + 2 (roles) + 5 (visibilidad) | ninguna | **cerrada, D-050** |
| **D2** | 3 (migración generada y aplicada) | fragmento de `deploy.yml` | diseñada |
| **D3** | 4 (generación server-side + reintento) + 6 (merge verificado) | +1 servicio, +1 checkout, +1 credencial | diseñada |

Se decidió trocear así (Leonardo, 2026-08-17) para que un fallo de la credencial de git de D3 no
contamine el diagnóstico de un cambio de registry. **Mientras D3 no esté, cada `generate` del piloto
lo lanza Sistemas y un corte de API cuesta ~3,4 USD sin reintento (D-048).**

---

## D1 — construido (detalle y decisiones en D-050)

Resumen de lo que quedó en el repo:

- **Cableado**: `apps/web/src/modules/registry.ts` descubre con `import.meta.glob` (build time: mismo
  bundle y mismo tree-shaking que antes) y `apps/api/src/modules/modules.loader.ts` descubre con
  `readdirSync` + `import()`. El módulo raíz de la API se construye con `await AppModule.register()`.
- **Roles**: `RolesSeedService` siembra los roles declarados en los `@Roles()` de los controllers
  registrados; `PUT /api/core/users/:id/roles` + casillas en `/admin/usuarios` los asignan, auditado.
  **Re-login obligatorio**: los roles viajan en el JWT. **La siembra la llama `main.ts` tras
  `listen()`, no un hook de Nest**: con `onApplicationBootstrap` cada `app.init()` de un e2e hacía una
  query a la BD y eso rompe la conexión perezosa de `PrismaService` (lo tumbó la CI, ver D-050).
- **Visibilidad**: `analysis_jobs` en el detalle de `/factory` y en `get_project_status`.

Tres cosas que conviene no volver a discutir:

1. **No se amplió el guardarraíl de generación.** Los dos archivos que el agente no podía tocar ya no
   necesitan edición. El guardarraíl sigue en `apps/api/src/modules/<slug>/`,
   `apps/web/src/modules/<slug>/` y `schema.prisma`.
2. **El canario cambió de sitio, no desapareció.** `REGISTRY_ISSUES` / `issues` del loader + tests que
   los assertean vacíos, e invariantes nuevos (ids/basePaths únicos, rutas dentro del basePath, rutas
   de negocio que responden 401 y no 404).
3. **La portada se declara** (`DEFAULT_HOME_MODULE_ID`). Con descubrimiento alfabético, "el primer
   módulo del menú" cambiaría solo al generar un módulo que ordene antes.

---

## D2 — Migración: generarla en el run, aplicarla en el Deploy (diseñado, sin construir)

**3a — Generarla.** Al terminar el agente y **antes** del commit, código nuestro (no el agente)
ejecuta:

```
prisma migrate diff \
  --from-schema-datamodel <schema.prisma de origin/main, a un temporal> \
  --to-schema-datamodel   apps/api/prisma/schema.prisma \
  --script
```

Datamodel → datamodel **no necesita shadow database ni conexión**: por eso esta forma y no
`--from-migrations` (que sí exige una BD viva; el runner no tiene ruta a la managed PG). El "antes"
sale de `git show origin/main:apps/api/prisma/schema.prisma`, que es la base de la rama.

Se escribe en `apps/api/prisma/migrations/<timestamp>_<slug>[_change<n>]/migration.sql` y entra en la
PR, revisable en el gate técnico. En una **regeneración** sobre la misma rama se borran primero las
carpetas de migración que la rama añadió respecto a `origin/main` (`git diff --name-only origin/main`)
y se reescribe: una migración por PR, sin apilar. Para un `request_change` sobre un módulo ya en
`main`, la base ya incluye el módulo → el diff es solo el delta.

**El límite conocido, resuelto sin consola.** Prisma no expresa índices únicos parciales (D-049). El
agente puede escribir `apps/api/src/modules/<slug>/migration.extra.sql` —**dentro de su carpeta, sin
ampliar el guardarraíl**— y nuestro código lo **añade al final** del `migration.sql` generado, con un
comentario que diga de dónde viene. El system prompt de generación gana una regla explícita: *«toda
constraint que la spec pida y Prisma no sepa declarar (índice único parcial, CHECK, exclusion
constraint) va en `migration.extra.sql`; el índice normal de Prisma no la sustituye»*. Esto no elimina
la revisión humana: la enfoca.

**3b — Aplicarla.** El job `staging` de `deploy.yml` corre las migraciones **entre `pull` y `up -d`**
con la imagen `migrator` que ya existe: `~/migrate.sh staging latest` y
`~/migrate-factory.sh staging latest` (las dos BD). Con `set -euo pipefail` un fallo de migración
**rompe el deploy en rojo** en vez de dejar un 500 silencioso — el tropiezo documentado dos veces en
STATUS. Y la regla «migrar solo tras CI de main verde» deja de ser disciplina humana: el trigger de
`deploy.yml` ya es `workflow_run` de CI en verde. Producción sigue con promoción manual y sha fijo.

**Aviso operativo**: `.github/workflows/*` es archivo protegido para el bridge de Cowork
(`device_commit_files` lo rechaza) — el fragmento se entrega para pegar a mano.

---

## D3 — Generación server-side con reintento + merge verificado (diseñado, sin construir)

### Dónde corre: **dos workers, misma imagen, checkouts distintos**

No es preferencia, es restricción física: el worker de análisis hace
`fetch + reset --hard origin/main + clean` antes de cada run; la generación vive en la rama
`factory/<slug>` con trabajo sin commitear y `node_modules` instalado. **Compartir working copy es
garantía de destrozo**, y con concurrencia 1 compartida una generación de 25 min bloquea un análisis
de 3 min — justo la espera que el gerente sí nota.

| | `factory-runner` (existe) | `factory-generator` (nuevo) |
|---|---|---|
| `FACTORY_WORKER_KINDS` | `analysis,change_analysis` | `generation,pr_merge` |
| checkout | `/platform-repo` (efímero, reset a main) | `/platform-repo-gen` (con `node_modules`) |
| credencial git | deploy key **solo lectura** | **PAT fine-grained** con push |
| toolchain | ninguna | `pnpm install` + build/lint/test + `gh` |

`claimNext` gana un filtro por `kind = ANY($kinds)`: una línea de SQL, la cola sigue siendo una tabla.
Coste de infra: +1 contenedor (~50 MB en reposo) y +1 checkout con `node_modules` (~1,5 GB de disco)
en el Lightsail compartido de 32 GB.

**Credencial (decisión de Leonardo, 2026-08-17): PAT fine-grained del repo** con `contents:write` +
`pull_requests:write` — una sola credencial sirve para el push (remoto HTTPS, `gh auth setup-git`) y
para `gh`, con caducidad y rotación. **Prerrequisito: protección de rama en `main`**, para que esa
credencial no pueda empujar a `main` ni por accidente ni por abuso. D-044 acota git a Sistemas; esto
lo abre a propósito y con mitigación, no por descuido.

### Disparo: aprobar el último gate encola la generación

`GatesService.decide`: si con esa aprobación quedan aprobados los gates requeridos (`functional` +
`technical`) de la spec → encola `kind: 'generation'` con el `specId`. Un `pr_review` que pide
«complementar» encola una **regeneración**. Es el fin de la fricción de D-048 («aprobé los dos gates y
no pasa nada») y respeta D-030: el HTTP encola, otro proceso ejecuta.

Cambios de esquema **aditivos** (`analysis_jobs`): `specId String?`, `nextAttemptAt DateTime?` y
`generation` + `pr_merge` en el enum `analysis_job_kind` (el enum ya se diseñó para admitirlos,
D-047). La tabla se seguirá llamando `analysis_jobs` aunque ya no sea solo de análisis: renombrarla
cuesta una migración destructiva y no aporta nada — deuda cosmética, anotada y no pagada.

### Reintento: clasificar el fallo, no reintentar a ciegas

`classifyFailure(error)` → `retryable | fatal`:

- **retryable** (infraestructura): `Connection closed mid-response`, `ECONNRESET`, `ETIMEDOUT`,
  `socket hang up`, HTTP 429 / 5xx / `overloaded_error`, `fetch failed`.
- **fatal** (agente o contrato): build/lint/test en rojo tras los reintentos del propio agente, gates
  no aprobados, transición inválida, spec inexistente, guardarraíl violado, `maxTurns`.
- **por defecto: fatal.** Lo caro es un bucle que gasta; lo barato es reencolar a mano un caso que
  todavía no clasificamos bien.

Con `retryable` y `attempts < 3`: el job vuelve a `queued` con `nextAttemptAt = now() + backoff`
(2 min → 10 min → 30 min), el `Run` se cierra en `error` **con su coste y tokens** (D-047 ya lo hace) y
el proyecto queda en `error`; el reintento hace `error → generating`, que la máquina de estados ya
permite — **cero cambios** en `state-machine.ts`. `claimNext` filtra
`("nextAttemptAt" IS NULL OR "nextAttemptAt" <= now())`.

**Reanudar funciona a nuestro favor**: D-048 lo comprobó en vivo — el prompt de REGENERACIÓN (D-031)
hace que el agente reconozca el código ya escrito y siga desde ahí (4,91 USD frente a rehacerlo desde
cero). El reintento automático se apoya en esa propiedad, no la inventa.

**Lo que NO cambia**: el agente sigue sin poder correr `git commit/push` (`BLOCKED_BASH_PATTERNS`), el
commit y la PR los hace nuestro código después, y el guardarraíl de escritura sigue acotado a las
carpetas del módulo. Mover la generación de máquina no relaja ni una regla.

### Bloque 6 — gate `pr_review` verificado + merge sin consola

Aprobar `pr_review` **no** transiciona a `staging`: encola `kind: 'pr_merge'`. El worker generador (que
ya tiene `gh` y token) hace `gh pr view` → si no está `MERGED`, espera checks (`gh pr checks --watch`)
y `gh pr merge --squash --delete-branch` → y **entonces** transiciona el proyecto a `staging`. Si falla
(conflicto, CI roja), el job queda en `error` con el motivo, el proyecto se queda en `pr_review` y se
ve en `/factory` (bloque 5). El gate deja de mentir porque el estado lo mueve quien comprobó la
realidad (D-049, «los gates son declarativos»).

**No en el contenedor `factory`**: el HTTP no tiene `gh` ni token y meterle una credencial de git
rompería la separación que D-047 defendió bien.

**La propiedad que NO se pierde**: `pr_review` es solo-admin y sigue exigiendo que **una persona lea el
diff**. Un gerente no puede llevar código a `main` aprobando gates de negocio. Esto es lo que sostiene
todo lo demás.

---

## Alternativas evaluadas y descartadas (para no volver a discutirlas)

- **Ampliar el guardarraíl** para que el agente cablee `app.module.ts`/`registry.ts`: trata el síntoma
  y le da al agente escritura fuera de su módulo.
- **Codegen de un `modules.generated.ts`**: garantía en tiempo de compilación, pero añade un artefacto
  generado que se queda viejo en local y un paso más al build.
- **Manifests en un paquete compartido `@awk/modules`** como fuente de los roles: más declarativo y con
  mejores descripciones, pero toca los ocho manifests y obliga a ampliar el guardarraíl. Es el
  movimiento correcto solo si algún día la API sirve el registry.
- **Un solo worker para análisis y generación**: head-of-line blocking (25 min bloquean 3 min) y, sobre
  todo, un único working copy que los dos flujos se pisarían.
- **`prisma migrate diff --from-migrations`**: exige una BD viva (shadow database) que el runner no
  tiene.
- **Que `RolesGuard` lea los roles de la BD en cada request** (elimina el re-login): +1 query por
  request y desacopla token de autorización. Es la solución de raíz; se deja para cuando haya un IdP de
  plataforma.
