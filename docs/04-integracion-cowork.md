# 04 · Integración con Cowork y pipeline de conversión

## Tipo de integración: plugin de organización (skill + conector MCP)

Tu preferencia (integración directa en vez de ZIP manual) es la correcta, y la forma concreta es un **plugin de Claude distribuido por el marketplace privado de la organización** que combina las dos piezas:

### 1. Skill `awk-prototipo` — estandariza la entrada

La mitad del éxito de la fábrica está en **normalizar el prototipo antes de que llegue al pipeline**. La skill guía a Claude cuando un gerente prototipa:

- Aplica la identidad Awakelab y patrones de UI consistentes.
- Hace las preguntas de negocio correctas (¿quién usa esto?, ¿qué datos maneja?, ¿alguno es confidencial?, ¿qué proceso reemplaza?).
- Produce, junto al HTML, un **`prototype.manifest.json`**: nombre, propósito, actores/roles, entidades de datos detectadas, clasificación de sensibilidad declarada, procesos relacionados. Este manifest es oro para el pipeline: convierte un HTML opaco en una solicitud semiestructurada.

### 2. Conector MCP `awkfactory` — conecta Cowork con la fábrica

Un remote MCP server (parte de la API de la fábrica) habilitado para la organización, con tools como:

| Tool | Función |
|---|---|
| `submit_prototype` | Envía HTML + manifest. Devuelve id y **URL de seguimiento** que Claude muestra al gerente. |
| `get_project_status` | Estado del pipeline, enlaces a preview/producción. El gerente pregunta "¿cómo va mi proyecto?" en Cowork. |
| `request_change` | **Mantenimiento (tu punto 4)**: describe un cambio sobre un módulo ya desplegado → la fábrica lanza el mismo pipeline en modo incremental → PR sobre el módulo existente. |
| `approve_spec` / `answer_question` | El gerente responde dudas del pipeline o aprueba la spec funcional sin salir de Cowork. |
| `list_modules` | Catálogo de módulos existentes y sus capacidades — **antiduplicación**: antes de aceptar un prototipo nuevo, Claude comprueba si ya existe algo equivalente y lo sugiere. |

### El dashboard (URL de seguimiento)

Tu frontend actual va en la dirección correcta. Evolución sugerida — añadir: timeline con los estados nuevos del pipeline, visor de la **spec en lenguaje de negocio** con botón aprobar/comentar, enlace a preview en staging, historial de cambios del módulo, y quién aprobó qué (auditoría). Quitar: la selección manual de subdominio por archivo (el dominio es de la plataforma; el módulo solo aporta su ruta) y los cambios de estado manuales desde la UI (los estados los mueve el pipeline; las personas solo aprueban/rechazan en los gates).

## El pipeline de conversión

La clave del diseño: **no se convierte el prototipo directamente en código**. Se genera una **spec intermedia** que es donde ocurre el control de calidad y la gobernanza.

```
1. INTAKE      submit_prototype → proyecto creado, URL de seguimiento
2. ANÁLISIS    Claude (Agent SDK) analiza HTML + manifest + módulos existentes:
               ├─ spec funcional (lenguaje de negocio, para el gerente)
               ├─ spec técnica: modelos Prisma, endpoints, pantallas, roles
               ├─ reutilización: qué resuelve el core o módulos existentes
               └─ score de complejidad y flags de sensibilidad
3. GATE SPEC   Gerente aprueba la funcional (vía Cowork o dashboard).
               Revisor técnico aprueba/ajusta la técnica — obligatorio u
               omitible según criterios de [05]. ← tu punto 5
4. GENERACIÓN  Runner con Agent SDK: rellena la plantilla de módulo en una
               rama del monorepo según la spec aprobada. Solo puede tocar
               las carpetas de su módulo.
5. VERIFICACIÓN CI: typecheck, lint de fronteras, tests generados,
               migraciones contra BD efímera. Falla → el runner itera (máx. N).
6. PR REVIEW   PR con spec enlazada y diff. Revisión humana según criterios
               de [05]; trivial → auto-merge.
7. STAGING     Deploy automático → preview URL → el gerente valida lo que pidió.
8. PRODUCCIÓN  Aceptación del gerente → promoción. Estado: Desplegado.
```

Los pasos 2 y 4 corren en vuestros VPS con **Claude Agent SDK** (headless, cuenta API corporativa). El mismo flujo con `request_change` opera sobre módulos existentes: analiza el módulo actual + la petición → mini-spec → gates → PR incremental.

## Por qué la spec intermedia importa

- Es el **punto de encuentro** gerente↔técnico que motivó todo el proyecto: el gerente valida comportamiento en su lenguaje; el técnico valida modelo de datos y arquitectura en el suyo. Ambos miran el mismo documento.
- Hace la generación **determinista y auditable**: el código se genera desde una spec aprobada, no desde una interpretación libre de un HTML.
- Los desacuerdos se detectan antes de generar código, donde corregir es barato.
