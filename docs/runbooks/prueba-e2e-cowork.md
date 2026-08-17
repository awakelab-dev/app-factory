# Runbook — Prueba END-TO-END desde Cowork (prototipo → deploy → monitoreo)

Estado de partida (2026-08-12, D-042b/D-043/D-044): el conector `awkfactory` **funciona en Cowork por OAuth** (login usuario/contraseña contra `factory_actors`, registro DCR automático) contra **staging**, y expone 6 tools: `list_modules`, `list_projects`, `submit_prototype`, `get_project_status`, `request_change`, `approve_spec`. La vista `estado-fabrica` carga datos reales.

Objetivo de la prueba: recorrer el ciclo completo con un caso pequeño y confirmar dónde hay fricción real antes de abrir la Fábrica a los Centros de Costo.

## 0. Prerrequisitos (ya cumplidos, verificar)

- Conector conectado en Cowork (si pide login: email + contraseña de la Fábrica, NO la cuenta de Claude).
- Actor propio en staging: `leonardo.barreto@awakelab.dev` (rol `admin` → ve todo) y, para probar la cara de gerente, `prueba.gerente@awakelab.dev` (rol `gerente` → ve solo lo suyo).
- Túnel SSH a la BD de staging disponible para los pasos de Sistemas (analyze/generate por CLI).

## 1. Crear el prototipo (usuario, en Cowork — lenguaje natural)

Elegir algo **pequeño y real** (no un CRUD gigante). Ejemplo de arranque:

> "Quiero una herramienta para registrar y aprobar solicitudes de compra menores: quien solicita carga monto, proveedor y motivo; su jefe aprueba o rechaza con comentario; y quiero ver un resumen mensual por centro de costo."

La skill `awk-prototipo` debe: (a) llamar **`list_modules` ANTES** de construir (antiduplicación), (b) hacer las preguntas de negocio (actores, entidades, sensibilidad por entidad), (c) producir el HTML autocontenido con identidad AWK-2026 + `prototype.manifest.json`.

**Qué observar**: si pregunta la sensibilidad de cada entidad (docs/05) y si respeta la identidad de marca.

## 2. Enviar a la Fábrica (usuario)

> "Envíala a la Fábrica"

→ `submit_prototype`. Debe devolver `projectId` y dejar el proyecto en **`received`**.

**Verificación**: `list_projects` (o la vista `estado-fabrica`, recargada) muestra el proyecto nuevo en fase "Recibido".

## 3. Análisis — AUTOMÁTICO desde D-047 (incremento C)

`submit_prototype` **encola** el análisis en la misma transacción que crea el
proyecto, y el worker (`factory-runner`) lo toma en segundos. Ya no hay ningún
comando que lanzar: el paso manual que esta prueba identificó como el bloqueante
del self-service (D-046) desapareció.

El worker materializa la fuente desde BD a `docs/pipeline/<slug>/source/`, corre
el Agent SDK, escribe las specs, crea la `Spec` v1 y abre los gates funcional +
técnico → estado `pending_approval`. Tarda unos minutos (1,37 USD y 5m46s en el
caso `incidencias-aula`).

**Verificación desde el chat**: `get_project_status` pasa de `received` →
`analyzing` → `pending_approval` sin que nadie toque nada.

**Si algo va mal** (diagnóstico de Sistemas, ya no del usuario):

```bash
# Logs del worker en el server:
docker compose --env-file .env -p awk-staging logs -f factory-runner

# Estado de la cola (por el túnel a la managed PG, PUERTO 15432 — los otros
# runbooks dicen 5433 y están equivocados, D-046):
ssh -N -L 15432:<ENDPOINT>:5432 AWK-Dev
psql ... -c "SELECT id, kind, status, attempts, \"errorMessage\" FROM analysis_jobs ORDER BY \"createdAt\" DESC LIMIT 5;"

# Reencolar un trabajo que quedó en error:
pnpm --filter=@awk/factory run cli -- enqueue-analysis --project <projectId>

# O analizarlo aquí y ahora, sin esperar al worker (escotilla):
pnpm --filter=@awk/factory run cli -- analyze <projectId>
```

> Un entorno incompleto ya NO deja el proyecto atascado en `analyzing` con un
> `Run` huérfano (bug 1 de D-046, corregido en D-047): el runner valida su
> configuración antes de tocar estado. Y si el proceso muere a mitad, el barrido
> del worker cierra el run y saca al proyecto de `analyzing` solo.

**Qué observar**: si la spec funcional refleja el prototipo sin alucinaciones
(compararla línea a línea) y el costo del run.

## 4. Aprobar los gates de negocio (usuario, en Cowork)

> "¿Cómo va mi proyecto?" → `get_project_status` (trae las specs y los gates)
> "Aprueba el gate funcional" → `approve_spec`

El gerente decide `functional` y `manager_acceptance`; los gates `technical` y `pr_review` son de Sistemas (403 si un gerente los intenta — comportamiento esperado).

**Qué observar**: si puede leer la spec en lenguaje de negocio desde el chat y decidir sin ayuda.

## 5. Generación + revisión técnica (Sistemas)

```bash
pnpm --filter=@awk/factory run cli -- decide-gate <gateIdTecnico> approved --notes "..."
pnpm --filter=@awk/factory run cli -- generate <specId>
```
Abre rama `factory/<slug>` y PR. Revisión de PR según docs/05 (si hay desviación: **no parchear a mano** — enmendar la nota del gate y regenerar). Luego merge, migración a mano si el módulo trae modelos nuevos, y deploy de staging.

## 6. Validación del usuario en staging + aceptación

El usuario prueba el módulo en `https://staging.apps.awakelab.world` y, si está bien:

> "Apruebo la aceptación del módulo" → `approve_spec` sobre el gate `manager_acceptance`

## 7. Monitoreo (el requisito de Gerencia)

- **Vista `estado-fabrica`** en Cowork: se deja abierta y se recarga; muestra fase, aprobaciones pendientes y KPIs. Con actor `admin` agrupa por responsable (vista consolidada de Sistemas); con `gerente` solo los propios.
- **En el chat**: "¿cómo van mis proyectos?" → `list_projects`.

## 8. Mantenimiento (cerrar el ciclo)

> "Al módulo <X> agrégale <Y>"

→ `request_change` registra la petición **y encola su análisis** (D-047; hasta
entonces solo registraba y el cambio se quedaba muerto en la base porque ningún
comando podía retomarlo — bug 2 de D-046) → gates frescos, decidibles desde el
chat → generación incremental sobre el módulo vivo.

> Solo se trabaja **una iteración por módulo a la vez**: si pides un cambio
> mientras el módulo tiene un análisis en curso, la petición queda registrada y
> la tool lo dice — hay que volver a pedirla cuando la iteración termine (o
> Sistemas la encola con `cli -- enqueue-analysis --project <id> --change-request <id>`).

## Qué anotar durante la prueba

1. **Cada punto donde el usuario necesitó ayuda de Sistemas** (candidatos a automatizar; el análisis del paso 3 ya se automatizó en D-047, queda `generate`).
2. Calidad de la spec generada (alucinaciones, alcance).
3. Costos de API por run (analyze/generate).
4. Si la vista de estado alcanza para "monitorear en cualquier momento" o falta algo (ej.: enlace directo al módulo en staging, historial de cambios).

## Brechas conocidas al iniciar la prueba

| Brecha | Impacto | Estado |
|---|---|---|
| ~~Análisis manual por CLI tras `submit_prototype`~~ | ~~El usuario espera a Sistemas en cada envío~~ | **CERRADA** por D-047 (incremento C): se encola y corre sola |
| `generate` sigue siendo manual | Tras aprobar los gates, el usuario espera a Sistemas para que el código se escriba | Fuera del alcance de C (necesita toolchain de build y credenciales de git en el runner) |
| AS OAuth solo en staging | El conector de producción no existe aún | Replicar deploy a producción |
| `FACTORY_OAUTH_JWKS` sin clave RSA persistente | Se genera una RSA efímera en cada reinicio (warning en el log) | Regenerar con `cli oauth-genkeys` y actualizar `.env` |
| Sin A2F ni rate limiting en el login del AS | Riesgo de fuerza bruta | **Fase 3** de docs/08 |


---

## Resultado de la prueba — 2026-08-15 (D-046)

Ejecutada con el caso **`incidencias-aula`** (proyecto `019ffa2c-eb45-70c4-a6a0-9224b7c3518d`): docente registra un parte, coordinación lo resuelve, dirección ve un resumen agregado sin datos identificativos. Recorrió el ciclo entero, incluido un `request_change` con su propia generación y despliegue.

**Qué salió del chat, sin Sistemas**: prototipado con la skill (con `list_modules` previo y sensibilidad por entidad), `submit_prototype`, lectura de las specs, **los cuatro tipos de gate con `approve_spec`** (`functional`, `technical`, `pr_review`, `manager_acceptance`), revisión de PR, `request_change` y seguimiento con `get_project_status`/`list_projects`.

**Corrección al guion**: el paso 5 daba por obligatorio decidir los gates técnicos por CLI. No lo es — el servidor los acepta desde el conector si el actor es `admin`. Para rol `gerente` siguen dando 403, que es el comportamiento correcto.

**Lo único que exigió CLI**: `analyze` y `generate`. Ese es, confirmado en la práctica, el bloqueante del self-service.

> **Actualización 2026-08-17 (D-050, incremento D fase D1) — pasos de este guion que YA NO EXISTEN:**
> - **El cableado del commit de integración**: no hay que editar `apps/api/src/app.module.ts` ni
>   `apps/web/src/modules/registry.ts`. Los módulos se descubren por carpeta; el commit de integración
>   se queda solo con la migración (y esa se automatiza en D2).
> - **El SQL de roles**: los roles que declara un módulo (sus `@Roles()`) existen en cuanto la API
>   arranca, y se asignan a un usuario desde **Administración → Usuarios**. Sigue haciendo falta
>   **volver a iniciar sesión** para que un rol nuevo surta efecto: viaja dentro del JWT.
> - **`docker compose logs` por SSH para saber por qué un proyecto no avanza**: el estado de la cola
>   (en cola / en curso / fallido, con intentos, worker y motivo) está en el detalle del proyecto en
>   `/factory` y en `get_project_status` desde el chat.
>
> Siguen exigiendo consola, con diseño ya validado en `docs/09-incremento-d-cero-consola.md`: escribir
> y aplicar la migración (**D2**) y lanzar `generate` (**D3**).

**Hallazgos** (detalle en D-046):

| # | Hallazgo | Estado |
|---|---|---|
| 1 | `analyze` manual tras `submit_prototype` | Incremento C |
| 2 | Ninguna forma de analizar una `ChangeRequest` creada desde Cowork | **Corregido**: `cli -- analyze-change` |
| 3 | `PLATFORM_REPO_PATH` se valida tras transicionar y crear el `Run` → proyecto atascado + run huérfano | **Corregido** (D-047, `assertRunnerEnv`) |
| 4 | El runner necesita su propio `apps/factory/.env`, sin aviso hasta que falla | Documentado arriba |
| 5 | Puerto del túnel mal documentado (5433 vs 15432 real) | Corregido aquí; pendiente en los otros 3 runbooks |
| 6 | Un run fallido no registra coste ni tokens (`costUsd: null`) | Incremento C |
| 7 | Sin reintento ni reanudación: un corte de red tira la generación entera | Diseñado, en el alcance de **D3** (docs/09) — el reintento clasificado va DENTRO de la generación server-side |
| 8 | Cada módulo nuevo rompe `registry.test.ts` (la generación no puede tocarlo) | **Desaparecido** (D-050): los módulos se descubren, ya no hay lista que editar. El test pasó a asserter invariantes (ids/basePaths únicos, rutas dentro del basePath, cero problemas de descubrimiento) |

**Costes registrados**: 12,64 USD en total — análisis 1,37 (5m46s), generación 8,39 (21m08s), análisis del cambio 0,68 (3m10s), generación del cambio 2,20 (7m29s). No incluye un análisis abortado ni una generación caída a los 23 minutos, ninguno de los dos con coste registrado (hallazgo 6).

**Calidad**: spec sin alucinaciones de alcance, con una sola imprecisión de hecho; 5 preguntas abiertas pertinentes; sensibilidad elevada por el propio análisis (alumnado menor de edad); y **las dos PRs aprobadas sin desviaciones, primera vez en el proyecto**. Las notas vinculantes de los gates volvieron a decidir el resultado: evitaron que la generación intentara tocar `@awk/types` (choque seguro con el guardarraíl) e incorporaron una ampliación de alcance que no estaba en la spec.
