# Spec funcional — `gestor-proyectos`

> Artefacto del pipeline de Fase 1 (docs/04, paso 2 — ANÁLISIS). Este documento es para aprobación del solicitante (Leonardo, vía `leonardo.barreto@awakelab.world`). No contiene detalle técnico — ver `spec-tecnica.md`.

## Origen

Prototipo `project-manager` (carpeta `/Users/leonardobarreto/projects/project-manager`), `index.html` único sin build system (CSS+JS inline, sin dependencias externas, sin backend): gestor de proyectos/tareas estilo kanban con login propio, roles Admin/Ejecutor y datos 100% en memoria del navegador (`let DB = {...}`) — no usa ni siquiera `localStorage`: **cualquier recarga de página vuelve a los datos de ejemplo**. A diferencia de `orientadorIA`, este prototipo parece hecho por el propio Leonardo (marca Awakelab ya aplicada, sin marca de cliente externo).

## Qué hace hoy (estado del prototipo)

- **Login** con usuario/contraseña contra una lista de usuarios hardcodeada en el JS del cliente (contraseñas en texto plano, visibles en el código fuente servido al navegador — mismo tipo de hallazgo que `orientador-ia`).
- **Dashboard**: KPIs (proyectos activos, tareas pendientes/finalizadas/atrasadas), alertas de tareas atrasadas, tabla "mis tareas".
- **Proyectos**: tarjetas con progreso; un Admin ve y crea/elimina todos los proyectos, un Ejecutor solo ve proyectos donde tiene al menos una tarea asignada.
- **Detalle de proyecto — tablero kanban por sprint**: 5 columnas (Iniciada/En progreso/En pausa/Cancelada/Finalizada), arrastrar-y-soltar para cambiar de estado, selector de sprint, botón "+ Sprint" (Admin, genera automáticamente un sprint de 10 días hábiles lunes-viernes tras el último).
- **Tarea**: cambio de estado, edición (título/fecha/asignado), subtareas (checklist), comentarios, eliminar — cada acción con una regla de permiso distinta (ver "Reglas de permisos").
- **Usuarios (Admin)**: lista, crear/editar/eliminar usuario, asignar rol Admin/Ejecutor, contraseña en texto plano editable desde la UI.
- **Reportes**: por proyecto+sprint — KPIs, proyección de cierre (avance real vs. avance esperado según días hábiles transcurridos), gráfico de barras por estado, desempeño por persona, atrasos.

## Reglas de permisos del prototipo (se conservan tal cual, son el corazón del producto)

- **Ver un proyecto**: Admin ve todos; Ejecutor solo los que tienen al menos una tarea asignada a él (no hay membresía explícita de equipo — se infiere de las tareas).
- **Cambiar estado / añadir subtareas y comentarios**: Admin, o la persona asignada a la tarea.
- **Editar tarea (título/fecha/asignado) o eliminarla**: Admin, o quien **creó** la tarea **y** sigue asignada a sí mismo — es decir, un Ejecutor no puede editar ni eliminar una tarea que le asignó un Admin (solo puede moverla de estado y añadir información), pero sí controla por completo las tareas que él mismo se auto-asigna.
- **Crear proyecto / sprint / gestionar usuarios**: solo Admin.

## Para quién

- **Admin**: gestiona proyectos, sprints, usuarios y tiene control total sobre todas las tareas. En la plataforma Awakelab esto corresponde al rol `admin` que **ya existe** (core, D-011) — Leonardo mismo hoy.
- **Ejecutor**: miembro de equipo con tareas asignadas; ve y opera solo lo suyo. Corresponde al rol `user` que **ya existe** (core) — no hace falta un rol nuevo (a diferencia de `orientador-ia`, que sí necesitó `orientador_admin` por ser un cliente externo).
- Uso 100% interno de Awakelab, sin superficie pública (a diferencia de `orientador-ia`).

## Flujo funcional (propuesto — reemplaza el login/almacenamiento del prototipo)

1. El usuario entra con su cuenta de la plataforma (mismo mecanismo que cualquier módulo: JWT dev-login hoy / IdP mañana, D-011) — **se elimina el login propio y las contraseñas en texto plano del prototipo**; no hay usuario/rol nuevo de plataforma, se reutilizan `admin`/`user` tal cual existen hoy.
2. Dashboard con KPIs y "mis tareas", como hoy.
3. Proyectos → detalle → tablero kanban por sprint, con arrastrar-y-soltar, igual que hoy.
4. Tarea → modal con estado/edición/subtareas/comentarios según las reglas de permiso de arriba, **verificadas también en el backend** (hoy el prototipo confía en ocultar botones en el cliente; cualquiera con la consola del navegador podría saltárselo).
5. Reportes por proyecto+sprint, igual que hoy.
6. Todo queda persistido en Postgres (hoy no persiste nada, ni siquiera entre recargas de la misma pestaña).

## Qué NO incluye este MVP (fuera de alcance, a menos que se pida explícitamente)

- **Gestión de usuarios (crear/editar/eliminar cuentas, asignar contraseña)**: el prototipo trae su propio CRUD de usuarios; la plataforma ya tiene un directorio de usuarios (`core.users`, módulo `core-admin`, hoy solo lectura). Duplicar un CRUD de usuarios dentro de `gestor-proyectos` sería crear una segunda fuente de verdad de identidad — **ver "Flags" y "Preguntas abiertas"**, es la decisión más importante de este gate.
- Notificaciones (email/push) por tarea asignada, vencimiento próximo, etc. — el prototipo no las tiene.
- Archivos adjuntos en tareas/comentarios.
- Membresía explícita de proyecto (invitar a alguien a un proyecto sin asignarle una tarea) — se mantiene la regla implícita del prototipo (ver "Preguntas abiertas").
- Multi-proyecto entre distintas organizaciones/clientes (esto es una herramienta interna de Awakelab, no se vende a un cliente externo como `orientador-ia`).

## Flags para el gate (docs/05 — por qué la revisión técnica es obligatoria)

- **Primer módulo de este tipo**: primer módulo de gestión de proyectos/tareas con tablero kanban, arrastrar-y-soltar y una matriz de permisos por tarea no trivial (creador vs. asignado vs. admin) — calibración necesaria, aunque no introduce RBAC nuevo (reutiliza `admin`/`user`, sin rol nuevo de manifest).
- **Posible migración de core**: si el gate decide que la gestión de usuarios (crear/editar/asignar rol) se resuelve extendiendo `core-admin` en vez de quedar fuera de alcance, eso toca el schema `core` y su revisión no es de este módulo — ver "Preguntas abiertas".
- **Datos de personal interno**: nombres/cuentas de empleados y sus asignaciones de tareas — mismo nivel que lo que `core.users` ya gestiona, sin dato nuevo sensible; el contenido libre de comentarios/tareas podría eventualmente mencionar información de clientes de Awakelab (ej. "en espera de credenciales del proveedor" en los datos de ejemplo) — se trata con el mismo criterio de RBAC + auditoría que un dato "confidencial" del core, sin necesitar RLS.

## Preguntas abiertas para Leonardo (antes de aprobar esta spec)

1. **Gestión de usuarios**: ¿queda fuera de alcance del MVP (los usuarios se siguen creando por seed/migración hasta que exista un CRUD de usuarios en `core-admin`), o se prioriza ahora extender `core-admin` con crear/editar/desactivar usuario + asignar rol (beneficia a toda la plataforma, no solo a este módulo)? Recomendación del análisis: dejarlo fuera de este MVP y tratarlo como una mejora de core aparte, priorizada según lo urgente que sea operar el gestor de proyectos con el equipo real.
2. **Membresía de proyecto**: ¿se mantiene la regla del prototipo ("participo si tengo al menos una tarea asignada") o se quiere poder añadir a alguien a un proyecto sin asignarle todavía una tarea (p. ej. para que vea el tablero desde el día 1)? Recomendación: mantener la regla del prototipo para el MVP, es simple y ya está validada por Leonardo en el prototipo.
3. **Duración/regla del sprint**: ¿se mantiene fija en 10 días hábiles (2 semanas L-V) como hoy, o debe ser configurable por proyecto?
4. **Migración de los datos de ejemplo**: los usuarios y proyectos de muestra del prototipo (Carla, Diego, María, 3 proyectos, 13 tareas) ¿se siembran también en staging para poder validar el módulo con datos reconocibles, o se arranca vacío?
