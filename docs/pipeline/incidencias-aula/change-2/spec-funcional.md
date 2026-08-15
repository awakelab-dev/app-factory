# Mini-spec funcional — cambio 2: priorización en la bandeja de coordinación

> Artefacto del pipeline (docs/04, `request_change`). Describe SOLO el delta sobre
> el módulo `incidencias-aula` ya generado y desplegado. No repite la spec
> funcional del módulo — esa sigue vigente para todo lo que no se menciona aquí.

## Petición (leonardo.barreto@awakelab.dev)

Hoy la bandeja de coordinación solo filtra por estado y por aula, y la tabla no
muestra cuánto tiempo lleva abierta cada incidencia. Una incidencia de gravedad
alta puede quedarse "enfriándose" sin que coordinación lo note. Se pide, **solo
en la vista de coordinación**:

1. Filtro por gravedad (baja/media/alta), combinable con los filtros de estado
   y aula que ya existen.
2. Columna "días abierta" en la tabla, con la bandeja ordenada por esa columna
   de mayor a menor cuando el filtro de estado no es "cerrada", y una marca
   visual (sin estado nuevo) para las incidencias abiertas/en curso con más de
   7 días.

## Qué NO cambia (explícito en la petición)

- El flujo de la incidencia (abierta → en_curso → cerrada) no se toca.
- Quién puede hacer qué no cambia: mismos roles, mismas acciones (tomar,
  seguimiento, cerrar), misma regla de permisos por fila.
- La vista del docente (`DocentePage`, alta + "mis incidencias") queda
  exactamente igual.
- El resumen mensual de Dirección (`DireccionPage`, agregados minimizados)
  queda exactamente igual — no se le añade gravedad ni "días abierta" ni se
  reordena.
- No se crea ningún estado nuevo. Una incidencia "estancada" sigue siendo
  `abierta` o `en_curso`; solo se resalta visualmente.

## Reglas de negocio del delta

### 1. Filtro por gravedad

- Combinable (AND) con los filtros existentes de estado y aula: se pueden usar
  los tres a la vez, dos, uno, o ninguno (bandeja completa), igual que hoy
  funciona la combinación estado+aula.
- Los KPIs de cabecera de la bandeja ("Sin tomar", "En curso", "Gravedad alta",
  "Cerradas") siguen calculándose sobre la bandeja **completa sin filtrar**,
  como ya ocurre hoy — el nuevo filtro de gravedad no los afecta.

### 2. Columna "días abierta"

- Es días **naturales** (no laborables), consistente con el resto del módulo
  (el resumen mensual de Dirección ya cuenta "días hasta cierre" en naturales).
- Se cuenta **desde la fecha de registro de la incidencia** (cuándo se dio de
  alta en el sistema) — no desde la "fecha del hecho" que informa el docente,
  que es un dato distinto y puede ser anterior al registro.
- Si la incidencia sigue `abierta` o `en_curso`: días naturales desde el
  registro hasta **hoy**.
- Si la incidencia está `cerrada`: días naturales desde el registro hasta la
  **fecha de cierre** (fijo, no sigue avanzando después de cerrada).

### 3. Orden de la bandeja

- Cuando el filtro de estado **no** es "cerrada" (esto incluye tanto "todos los
  estados" como el filtro explícito "abierta" o "en curso"): la bandeja se
  ordena por "días abierta" de mayor a menor, para que lo más estancado quede
  arriba.
- Cuando el filtro de estado **es** "cerrada": se mantiene el orden actual (por
  fecha de registro, más reciente primero) — la petición no pide reordenar la
  vista de incidencias ya resueltas, y priorizar "lo más estancado" no aplica a
  algo que ya se resolvió.

### 4. Marca visual de estancamiento

- Se aplica solo a incidencias `abierta` o `en_curso` con más de 7 días
  abiertas (estrictamente más de 7, no 7 exactos).
- Es una distinción **visual** en la tabla (p. ej. resaltado o icono junto a la
  columna), no un badge de estado ni un campo nuevo de negocio: el valor de
  `estado` de la incidencia no cambia.
- No aplica a incidencias `cerrada` (su "reloj" ya se detuvo en el cierre).

## Fuera de alcance de este cambio

- No se toca el catálogo de gravedad, tipo, ni aulas.
- No se añade filtro de gravedad ni columna de días a la vista del docente ni
  al resumen de Dirección.
- No se introduce paginación ni cambia el volumen de datos que trae la
  bandeja — solo su orden, un filtro adicional y una columna calculada.
