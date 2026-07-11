# 03 · Arquitectura

Dos sistemas separados que conviene no mezclar:

1. **La Plataforma** (`awkplatform`): la aplicación corporativa modular donde viven los módulos generados. Es lo que usan los usuarios finales.
2. **La Fábrica** (`awkfactory`): el control plane que recibe prototipos, orquesta la conversión y despliega. Es lo que usan gerentes (seguimiento) y revisores técnicos.

## La Plataforma

```
                    ┌─────────────────────────────────────┐
 Usuarios ──SSO──▶  │  Shell React (apps/web)             │
                    │  menú y rutas según RBAC + manifests │
                    └───────────────┬─────────────────────┘
                                    │ HTTPS (OpenAPI, JWT)
                    ┌───────────────▼─────────────────────┐
                    │  API NestJS (apps/api)              │
                    │  core: auth, RBAC, usuarios, audit  │
                    │  modules/: facturacion, alumnos ... │
                    └───────────────┬─────────────────────┘
                                    │ Prisma
                    ┌───────────────▼─────────────────────┐
                    │  PostgreSQL                         │
                    │  schema core | schema por módulo    │
                    │  RLS para datos confidenciales      │
                    └─────────────────────────────────────┘
```

- **Core** (se construye una vez, a mano, con máxima calidad): autenticación SSO, RBAC (roles globales + permisos por módulo), gestión de usuarios, auditoría, notificaciones, componentes UI de marca.
- **Módulos** (los genera la fábrica): aislados en su carpeta y su schema PG; solo acceden a `core` mediante servicios públicos del core y a otros módulos vía sus APIs — regla verificada por lint/CI.
- **Identidad**: SSO único. Si el grupo usa Microsoft 365, integrar **Entra ID** (OIDC); si no, **Keycloak** self-hosted. Los roles de negocio viven en la plataforma, no en el IdP.

## La Fábrica (control plane)

Evolución del backend actual de este repo, migrado al stack estándar:

- **API de la fábrica**: recibe prototipos (desde el conector MCP de Cowork), gestiona proyectos, estados, specs, aprobaciones. Expone el dashboard de seguimiento (evolución del frontend actual).
- **Runner de generación**: workers en contenedor que ejecutan **Claude Agent SDK headless** con el monorepo de la plataforma clonado: leen la spec aprobada, rellenan la plantilla de módulo, ejecutan build/tests localmente y abren PR. Cola de trabajos (BullMQ + Redis) para procesar en serie/paralelo controlado.
- **Estados del proyecto** (sustituye al enum actual): `Recibido → Analizando → Spec lista → Aprobación pendiente → Generando → Verificando → PR en revisión → Staging (preview) → Aceptación del gerente → Desplegado` + `Rechazado / Cambios solicitados / Error`.

## Infraestructura y deploy (AWS Lightsail — infraestructura existente del grupo)

Contexto: Awakelab/Aspasia opera 36 Moodles en 5 Lightsails con Nginx nativo y RDS Aurora MariaDB en red privada. Este proyecto se alinea con ese esquema, con dos correcciones deliberadas: Postgres en vez de MariaDB y sin Aurora.

| Pieza | Decisión |
|---|---|
| Servidor | **Lightsail 32GB RAM / 640GB SSD** nuevo, en la misma red privada que el resto de instancias. Aloja plataforma, fábrica y runners; discos attachables si crece. |
| Orquestación | **Docker Compose** (sin PaaS): como la unidad de deploy es una sola plataforma, Coolify/Dokploy sobrarían. Docker se justifica por: paridad CI↔producción (la imagen que pasó los tests es la que se despliega), rollback = tag de imagen anterior, y porque los runners del Agent SDK requieren contenedores efímeros de todos modos (aislamiento). |
| Reverse proxy | **Nginx nativo en el host** (mismo patrón que los Moodles) proxy hacia los contenedores; SSL con certbot. DNS `*.awkfactory.com` → IP del Lightsail. |
| Git + CI | **GitHub privado + GitHub Actions**: typecheck, lint, tests, migración en BD efímera, build de imagen → push a GHCR → webhook/SSH al Lightsail hace `pull` + `compose up`. |
| Entornos | Staging = segundo proyecto compose en la misma máquina (`staging.awkfactory.com`); producción en el dominio corporativo. Promoción = re-tag de la misma imagen. |
| Base de datos | **Lightsail managed database PostgreSQL desde el día 1** — plan Standard $30/mes (2GB RAM, 80GB SSD, **cifrado en reposo**; el plan de $15 no cifra y queda descartado), en **modo privado** (solo accesible desde recursos Lightsail, mismo patrón que el RDS actual del grupo). Incluye backups automáticos con point-in-time restore (7 días), parches gestionados y métricas. Escalado por snapshot→instancia mayor (corte planificado de minutos). Snapshots manuales adicionales antes de cada migración de esquema. **No Aurora**: su piso de costo (instancia + I/O + storage 6x) paga alta disponibilidad innecesaria a esta escala. BD efímera para CI/tests sí corre en contenedor. |
| Secretos | Variables de entorno por compose project, fuera del repo (SSM Parameter Store como fuente si se quiere centralizar); nunca en el repo ni en las specs. |
| Observabilidad | Uptime Kuma (disponibilidad) + Sentry self-hosted o Grafana/Loki (errores y logs). El dashboard de la fábrica muestra salud por módulo. |

**Nota importante sobre el punto 3 de tus requerimientos**: el deploy automatizado existe, pero la unidad de deploy es **la plataforma completa** (imagen del monorepo), no cada módulo por separado. Merge de la PR del módulo → CI → deploy a staging → aceptación → promoción a producción. Esto simplifica radicalmente la operación (un artefacto, un pipeline) y es coherente con el modelo modular. Apps genuinamente aisladas (casos excepcionales) pueden desplegarse standalone vía el mismo PaaS.
