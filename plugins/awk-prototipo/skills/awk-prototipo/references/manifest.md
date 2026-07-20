# prototype.manifest.json — formato exacto

El manifest se valida en la Fábrica con un schema estricto (`prototypeManifestSchema` de `@awk/types`). Si no valida, `submit_prototype` rechaza el envío. Respetar límites y valores literales.

## Campos

| Campo | Tipo | Obligatorio | Restricciones |
|---|---|---|---|
| `name` | string | sí | 1–120 chars. Nombre de negocio (NO el slug). |
| `purpose` | string | sí | 1–2000 chars. Qué problema resuelve y para quién, en lenguaje de negocio. |
| `actors` | array | sí, mínimo 1 | Objetos `{ role, description? }`. |
| `actors[].role` | string | sí | 1–80 chars (p. ej. "Coordinador académico"). |
| `actors[].description` | string | no | ≤500 chars. Qué hace ese rol en el módulo. |
| `entities` | array | sí, mínimo 1 | Objetos `{ name, description?, sensitivity }`. |
| `entities[].name` | string | sí | 1–80 chars (p. ej. "Alumno", "Factura"). |
| `entities[].description` | string | no | ≤500 chars. |
| `entities[].sensitivity` | enum | **sí, en cada entidad** | Exactamente uno de: `"publico"`, `"interno"`, `"confidencial"`, `"datos_personales"` (minúsculas, sin tildes, guion bajo). |
| `relatedProcesses` | array de strings | no (default `[]`) | Cada string 1–200 chars. Procesos que reemplaza o con los que se relaciona. |

## Clasificación de sensibilidad (gobernanza Awakelab)

- `publico` — publicable fuera de la organización sin daño.
- `interno` — operativa interna; filtración sin daño relevante.
- `confidencial` — filtración con daño de negocio (finanzas, contratos, evaluaciones).
- `datos_personales` — identifica personas → RGPD (nombres, emails, expedientes, salud).

En duda, elegir el nivel MÁS restrictivo. El análisis de la Fábrica verifica la clasificación y puede **elevarla, nunca rebajarla**: subestimar solo retrasa el proyecto.

## Ejemplo completo válido

Ver `ejemplo-manifest.json` en esta misma carpeta. Reproducido:

```json
{
  "name": "Gestor de Becas",
  "purpose": "Centraliza la gestión de solicitudes de beca de los alumnos de FP: recepción, evaluación por el comité y notificación del resultado. Reemplaza el Excel compartido que hoy usa administración y elimina el correo manual de resultados.",
  "actors": [
    { "role": "Administración", "description": "Recibe solicitudes, adjunta documentación y publica resultados." },
    { "role": "Comité de becas", "description": "Evalúa cada solicitud y registra la decisión con su motivo." },
    { "role": "Alumno", "description": "Presenta su solicitud y consulta el estado." }
  ],
  "entities": [
    { "name": "Solicitud de beca", "description": "Datos académicos y económicos aportados por el alumno.", "sensitivity": "datos_personales" },
    { "name": "Decisión del comité", "description": "Resolución, cuantía concedida y motivo.", "sensitivity": "confidencial" },
    { "name": "Convocatoria", "description": "Plazos, requisitos y cuantías publicadas de cada convocatoria.", "sensitivity": "publico" }
  ],
  "relatedProcesses": [
    "Excel de seguimiento de becas de administración",
    "Correo manual de notificación de resultados",
    "Proceso de matrícula (la beca condiciona el importe)"
  ]
}
```

## Errores comunes que invalidan el manifest

- `sensitivity` ausente en alguna entidad, o con valores como `"público"`, `"Datos personales"`, `"personal"` — debe ser el literal exacto.
- `actors` o `entities` vacíos.
- Meter el slug en `name` — `name` es el nombre de negocio; el slug va aparte en `submit_prototype.moduleSlug` (kebab-case, 3–60, patrón `^[a-z][a-z0-9-]*[a-z0-9]$`).
- Pasar `manifest` como string JSON en vez de como objeto.
