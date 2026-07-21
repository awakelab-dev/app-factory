# 05 · Gobernanza, revisión técnica y seguridad

## Roles del proceso

| Rol | Hace | No hace |
|---|---|---|
| **Gerente (solicitante)** | Prototipa, envía, aprueba spec funcional, valida en staging, acepta a producción, pide cambios | No aprueba aspectos técnicos ni ve specs de otros sin permiso |
| **Revisor técnico** (equipo dev, rotativo) | Aprueba/ajusta spec técnica y PRs marcadas para revisión; puede rechazar con motivo o devolver con complementos | No reescribe a mano salvo excepción: si el código generado necesita retoques recurrentes, se corrige la plantilla o la skill, no el módulo |
| **CTO / arquitecto** | Define criterios de gate, plantillas, políticas de datos; resuelve escaladas | No participa en cada proyecto |

## Cuándo la revisión humana es obligatoria (gates 3 y 6 del pipeline)

Revisión técnica **obligatoria** si se cumple cualquiera:

- La spec declara o el análisis detecta datos **confidenciales o personales** (RGPD).
- La migración toca el schema `core` o tablas de otro módulo.
- Score de complejidad alto (nº de entidades, integraciones externas, lógica de negocio no trivial) o **alcance ambiguo** señalado por el propio análisis.
- Es el primer módulo de un gerente/área (calibración).
- Introduce dependencias nuevas o llamadas a sistemas externos.

Si nada aplica → auto-aprobación con muestreo aleatorio (p. ej. 1 de cada 5 se revisa igualmente, para vigilar la deriva de calidad). El revisor tiene tres salidas: **aprobar**, **rechazar con motivo** (vuelve al gerente vía Cowork), o **complementar** (edita la spec técnica y el pipeline regenera desde la spec corregida — nunca parchea código a mano).

## Datos sensibles (tu problema 3)

1. **Clasificación en origen**: la skill de prototipado obliga a declarar sensibilidad por entidad (`público / interno / confidencial / datos personales`). El análisis (paso 2) la verifica y puede elevarla, nunca rebajarla.
2. **Enforcement en plataforma**: la clasificación viaja en el `module.manifest.ts` y se traduce en permisos RBAC por endpoint y **Row-Level Security** en Postgres para confidencial. No es documentación: es política ejecutable.
3. **Auditoría**: el core registra accesos a entidades confidenciales; visible para el propietario del dato.
4. **RGPD**: datos en VPS propios (encaja con vuestra elección de infraestructura), registro de actividades de tratamiento por módulo derivable de los manifests, y minimización revisada en el gate técnico.

## Seguridad de la fábrica misma

- El runner de generación trabaja en contenedor efímero, con token de solo-escritura sobre ramas `factory/*` (nunca `main`), y sin acceso a secretos de producción.
- Merge a `main` solo vía PR con checks verdes; producción solo por promoción desde staging.
- El conector MCP autentica a cada gerente (OAuth contra el AS propio de la Fábrica, login usuario/contraseña — D-041; la formulación original "OAuth contra el SSO" quedó sin IdP al descartar la org Entra ID): `submit` y `approve` quedan firmados por persona.
- Prompt injection: el HTML del prototipo es entrada no confiable; el runner lo trata como datos (nunca como instrucciones con autoridad) y las plantillas limitan lo que puede escribirse.
