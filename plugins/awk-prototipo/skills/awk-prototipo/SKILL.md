---
name: awk-prototipo
description: >
  Esta skill debe usarse cuando un gerente de Awakelab quiere "prototipar",
  "crear un prototipo", "hacer una app/herramienta/módulo", "maquetar una idea",
  "enviar un prototipo a la Fábrica", pedir un cambio sobre un módulo existente
  de la plataforma, o consultar "cómo va mi proyecto" en la Fábrica. Guía el
  prototipado con la identidad Awakelab 2026, recoge el contexto de negocio,
  produce el HTML autocontenido + prototype.manifest.json y lo envía a la
  Fábrica vía el conector awkfactory.
metadata:
  version: "0.1.0"
---

# awk-prototipo — de la idea del gerente a la Fábrica

Convertir la idea de un gerente en un prototipo estandarizado y enviarlo a la Fábrica de Awakelab, que lo transformará en un módulo real de la plataforma. El resultado de esta skill son SIEMPRE dos artefactos — un HTML autocontenido y un `prototype.manifest.json` — más una submission creada vía la tool `submit_prototype` del conector `awkfactory`.

Hablar con el gerente en lenguaje de negocio, en español, sin jerga técnica. No mencionar schemas, Zod, MCP ni slugs salvo que pregunte.

## Flujo obligatorio

### 1. Antiduplicación — antes de invertir trabajo

Llamar a `list_modules` (conector `awkfactory`) ANTES de empezar a construir nada. Si ya existe un módulo (o un proyecto en curso) que cubre lo que el gerente pide:

- Mostrárselo y explicar qué hace (usar `specSummary`).
- Si lo que quiere es una mejora de ese módulo → usar `request_change` sobre ese proyecto, no crear un prototipo nuevo.
- Solo continuar con un prototipo nuevo si el gerente confirma que es algo distinto.

Si `list_modules` falla con un error de autenticación (401), el token del conector no está configurado: indicar al gerente que revise la guía de instalación del plugin con el equipo técnico (Leonardo) y NO continuar con el envío — el prototipo puede construirse igualmente y enviarse después.

### 2. Preguntas de negocio — recoger el contexto ANTES de construir

Hacer estas preguntas (en una sola tanda, conversacional, no como interrogatorio). Son la materia prima del manifest:

1. **¿Qué problema resuelve y para quién?** (propósito, en lenguaje de negocio)
2. **¿Quién lo va a usar?** — roles/actores concretos (p. ej. "coordinador académico", "alumno", "administración"), y qué hace cada uno.
3. **¿Qué datos maneja?** — las "cosas" del negocio (entidades: alumnos, cursos, facturas, tareas…).
4. **Por cada dato: ¿qué tan sensible es?** — obligatorio clasificar cada entidad en uno de estos 4 niveles (en caso de duda, elegir el nivel MÁS restrictivo; el análisis de la Fábrica puede elevar la clasificación, nunca rebajarla):
   - `publico` — podría publicarse fuera de la organización sin daño.
   - `interno` — operativa interna; su filtración no causa daño relevante.
   - `confidencial` — su filtración daña al negocio (finanzas, contratos, evaluaciones…).
   - `datos_personales` — identifica a personas (nombres, emails, notas, salud…) → RGPD.
5. **¿Qué proceso reemplaza o con cuáles se relaciona?** — Excel actual, proceso manual, otro sistema.

No bloquear la creatividad: si el gerente quiere ver algo en pantalla primero, construir un borrador y hacer las preguntas durante la iteración — pero NUNCA enviar a la Fábrica sin todas las respuestas.

### 3. Construir el prototipo HTML

Reglas duras del artefacto:

- **Un único archivo HTML autocontenido**: CSS y JS inline. Librerías externas solo desde `https://cdnjs.cloudflare.com`. Máximo 5 MB (evitar imágenes en base64; usar los logos por URL).
- **Identidad Awakelab 2026 obligatoria**: leer `references/identidad-awakelab.md` de esta skill antes de escribir el HTML (Poppins, paleta de cianes vivos y azules profundos, logos oficiales por URL). No usar el estilo obsoleto (Rubik, navy #2E4053, teal #3EBFC7).
- **Sin backend real**: simular datos y flujos con JS en memoria. Nada de `fetch` a servicios reales ni claves de API.
- **Datos demo inventados**: NUNCA datos reales de personas (nombres, emails, notas reales). Inventar datos verosímiles.
- Es un prototipo de comportamiento, no un producto: priorizar que el gerente pueda "tocar" el flujo completo sobre la perfección visual.

Guardar el HTML en la carpeta del usuario como `prototype.html` (o `<nombre>-prototype.html`) y presentárselo. Iterar hasta que el gerente lo dé por bueno.

### 4. Producir `prototype.manifest.json`

Cuando el gerente apruebe el prototipo, generar el manifest EXACTAMENTE con esta estructura (detalle completo y ejemplo en `references/manifest.md` — leerlo antes de generar el archivo):

- `name` (1–120 chars): nombre de negocio del prototipo.
- `purpose` (1–2000 chars): qué problema resuelve y para quién.
- `actors` (mínimo 1): `[{ "role": "…" (1–80), "description": "…" (≤500, opcional) }]`.
- `entities` (mínimo 1): `[{ "name": "…" (1–80), "description": "…" (≤500, opcional), "sensitivity": "publico" | "interno" | "confidencial" | "datos_personales" }]` — `sensitivity` es OBLIGATORIA en cada entidad, con esos valores literales (minúsculas, `datos_personales` con guion bajo).
- `relatedProcesses` (lista de strings ≤200, puede ser `[]`): procesos que reemplaza o toca.

Guardar el archivo como `prototype.manifest.json` junto al HTML y mostrar al gerente un resumen en lenguaje de negocio (no el JSON) para que confirme, con especial atención a la clasificación de sensibilidad.

### 5. Enviar a la Fábrica

1. Llamar a `list_modules` otra vez (comprobación final de duplicados — pudo cambiar el catálogo durante la sesión).
2. Llamar a `submit_prototype` con:
   - `moduleSlug`: kebab-case, 3–60 chars, patrón `^[a-z][a-z0-9-]*[a-z0-9]$` (proponerlo derivado del nombre; p. ej. "Gestor de Becas" → `gestor-becas`).
   - `displayName` (1–120): el nombre de negocio.
   - `sourceHtml`: el contenido COMPLETO del HTML (no una ruta).
   - `manifest`: el objeto del manifest (no un string).
3. Mostrar al gerente el resultado: el proyecto quedó **"recibido, pendiente de análisis"**; la Fábrica correrá el análisis y abrirá los gates. Darle el `projectId` y explicarle que puede preguntar "¿cómo va mi proyecto?" en cualquier momento (→ `get_project_status`).

Manejo de errores de `submit_prototype`:

- **409 (slug ya existe)**: leer el mensaje — o el módulo ya existe (→ proponer `request_change`) o basta cambiar el `moduleSlug`.
- **Error de validación**: revisar el manifest contra `references/manifest.md` (límites de longitud, valores de sensibilidad) y reintentar.
- Cualquier otro error: mostrar el motivo tal cual (los errores del conector son accionables) y conservar los dos archivos locales — no se pierde nada, se puede reenviar.

## Después del envío

- **"¿Cómo va mi proyecto?"** → `get_project_status` con el `projectId`. Traducir el estado a lenguaje de negocio (recibido / en análisis / esperando tu aprobación / en construcción / en pruebas / desplegado).
- **Aprobar la spec funcional**: cuando haya un gate `functional` o `manager_acceptance` pendiente, leer la spec con `get_project_status`, resumírsela al gerente en su lenguaje y decidir con `approve_spec` (aprobar / rechazar / pedir cambios — al rechazar o pedir cambios, `notes` con el porqué es obligatorio de facto). Los gates técnicos no son del gerente: no intentar decidirlos.
- **Cambios sobre un módulo vivo**: `request_change` con el `projectId` y una descripción concreta en lenguaje de negocio de qué debe cambiar y por qué (mínimo 10 chars; cuanto más concreto, mejor análisis).
