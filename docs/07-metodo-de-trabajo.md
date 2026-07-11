# 07 · Método de trabajo con Claude Cowork

Cómo Leonardo trabaja este proyecto en múltiples tareas independientes de Cowork sin perder contexto ni gastar de más.

## El problema y la solución

Cada tarea de Cowork es una conversación aislada: no hereda lo hablado en otras. La memoria compartida entre tareas es **el propio repo**:

- `CLAUDE.md` (raíz): se carga automáticamente en toda sesión sobre esta carpeta. Contiene el resumen mínimo + el protocolo.
- `docs/STATUS.md`: estado vivo — qué está hecho, en curso y siguiente. Toda sesión lo lee al empezar y **lo actualiza al terminar**.
- `docs/DECISIONES.md`: log append-only. Una tarea nueva no puede contradecir una decisión sin proponerlo explícitamente.
- `docs/01..06`: la estrategia estable (cambia poco).

Regla de oro: **si algo debe sobrevivir a esta conversación, va a un archivo del repo**. El protocolo de cierre de sesión (en CLAUDE.md) garantiza que el contexto evoluciona solo.

## Tipos de tarea y modelo recomendado

Abrir una tarea nueva por unidad de trabajo coherente (una feature, una decisión, una duda). Nombrarlas con prefijo para orden mental: `[core]`, `[infra]`, `[module:X]`, `[factory]`, `[docs]`, `[duda]`.

| Tipo de tarea | Ejemplos | Modelo |
|---|---|---|
| Arquitectura, decisiones estructurales, diseño del core (auth/RBAC), modelado de datos, seguridad | "Diseñar el sistema RBAC", "revisar la spec del pipeline" | **Fable 5** (u Opus) — errores aquí son caros de revertir |
| Desarrollo estándar | Implementar endpoints, pantallas, tests, CI, un módulo sobre plantilla existente | **Sonnet** — el mejor costo/calidad para código; es el caballo de batalla, debería ser el modelo por defecto del día a día |
| Tareas mecánicas y consultas simples | Actualizar docs, renombrar, commits, "¿qué estado tiene X?", scripts pequeños | **Haiku** — céntimos |

Criterio rápido: si equivocarse cuesta una re-arquitectura → Fable; si cuesta una re-ejecución → Sonnet; si cuesta un minuto → Haiku. En caso de duda, Sonnet.

## Ciclo de vida de una tarea

1. **Abrir tarea** en Cowork sobre esta carpeta, con nombre prefijado y modelo según la tabla.
2. Primer mensaje: objetivo concreto + criterio de "terminado". Claude lee STATUS.md automáticamente (protocolo de CLAUDE.md).
3. Trabajo normal. Cambios estructurales inesperados → se proponen antes de implementar.
4. **Cerrar**: pedir a Claude "cierra la sesión" → actualiza STATUS.md, añade a DECISIONES.md si aplica, commit. Una tarea sin cierre es contexto perdido.

### Cierre parcial (tarea inconclusa)

"Cierra la sesión" funciona igual con trabajo a medias: STATUS.md registra en "En curso" el punto exacto (hecho / falta / próximo paso concreto) y se commitea el avance (`[wip]` si el código no compila). Para retomar:

- **Volverás pronto y la conversación no es larga** → reabrir la misma conversación de Cowork (conserva el contexto fino).
- **Pasarán días o la conversación ya pesa** → tarea nueva; arranca desde STATUS.md.

Si otra tarea necesita contexto parcial de una inconclusa, el cierre parcial es obligatorio antes de abrirla: STATUS.md es el canal entre tareas, nunca la memoria conversacional.

## Escalabilidad del método

- **Hoy (solo Leonardo)**: el repo + git es suficiente coordinación. Commits frecuentes; `main` siempre funcional.
- **Cuando entre el equipo**: el mismo sistema escala sin cambios — CLAUDE.md y docs sirven igual a personas que a Claude; solo se añade trabajo por ramas + PRs (el protocolo de cierre pasa a ser parte del PR). Los revisores técnicos de la fábrica ([05](05-gobernanza-seguridad.md)) heredan estos docs como onboarding.
- **Higiene periódica** (mensual o al cerrar fase, tarea tipo `[docs]` con Haiku/Sonnet): compactar STATUS.md, verificar que docs/01..06 siguen reflejando la realidad, archivar lo obsoleto en `docs/archivo/`.
- Claude mantiene además una memoria propia entre sesiones de este espacio de trabajo, pero se trata como caché conveniente, **no** como fuente de verdad: la verdad vive en el repo, que es portable y visible para el futuro equipo.
