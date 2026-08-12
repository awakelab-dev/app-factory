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

## 3. Análisis — HOY LO DISPARA SISTEMAS (brecha conocida)

`submit_prototype` NO corre el análisis (D-030/D-036): el proyecto queda en `received` hasta que Sistemas lo lanza por CLI. **Es el bloqueante del self-service** y el objeto del **incremento C**.

```bash
# con el túnel abierto y FACTORY_DATABASE_URL de staging exportada
pnpm --filter=@awk/factory run cli -- analyze <projectId>
```

El runner materializa la fuente desde BD a `docs/pipeline/<slug>/source/`, corre el Agent SDK, escribe las specs, crea la `Spec` v1 y abre los gates funcional + técnico → estado `pending_approval`.

**Qué observar**: si la spec funcional refleja el prototipo sin alucinaciones (compararla línea a línea) y el costo del run.

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

→ `request_change` → Sistemas corre `analyze` del cambio → gates frescos → generación incremental sobre el módulo vivo.

## Qué anotar durante la prueba

1. **Cada punto donde el usuario necesitó ayuda de Sistemas** (candidatos a automatizar; el análisis del paso 3 ya está identificado).
2. Calidad de la spec generada (alucinaciones, alcance).
3. Costos de API por run (analyze/generate).
4. Si la vista de estado alcanza para "monitorear en cualquier momento" o falta algo (ej.: enlace directo al módulo en staging, historial de cambios).

## Brechas conocidas al iniciar la prueba

| Brecha | Impacto | Estado |
|---|---|---|
| Análisis manual por CLI tras `submit_prototype` | El usuario espera a Sistemas en cada envío | **Incremento C**, siguiente build |
| AS OAuth solo en staging | El conector de producción no existe aún | Replicar deploy a producción |
| `FACTORY_OAUTH_JWKS` sin clave RSA persistente | Se genera una RSA efímera en cada reinicio (warning en el log) | Regenerar con `cli oauth-genkeys` y actualizar `.env` |
| Sin A2F ni rate limiting en el login del AS | Riesgo de fuerza bruta | **Fase 3** de docs/08 |
