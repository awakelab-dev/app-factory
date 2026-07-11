# Runbook · Provisión de Lightsail managed PostgreSQL (consola AWS)

> Runbook operativo, no de estrategia. Ejecuta el aprovisionamiento de la base de datos gestionada definida en **[D-004](../DECISIONES.md)** y **[roadmap Fase 0](../06-roadmap.md)**. Última revisión: 2026-07-11 (precios/planes verificados en la página de precios de AWS Lightsail ese día).

## Qué vas a crear

Una instancia **Lightsail managed database PostgreSQL**, plan **Standard $30/mes** (2 GB RAM · 1 vCPU · 80 GB SSD · 100 GB transfer/mes · **cifrado en reposo**), en **modo privado**, en la **misma región** que el resto de Lightsails del grupo. Sobre esa única instancia conviven dos bases lógicas: `staging` y `production` (roadmap Fase 0).

Por qué este plan exactamente: es el escalón más pequeño que **cifra en reposo** ($15 no cifra → descartado en D-004). El plan HA ($60) duplica el precio para alta disponibilidad que a esta escala no se paga (D-004). No Aurora.

## Prerrequisitos (leer antes de tocar la consola)

1. **Región — decisión crítica e irreversible sin migración.** El "modo privado" de Lightsail es *scoped por región*: la BD solo es alcanzable por recursos Lightsail de **su misma región**. Debes crearla en la **misma región donde vive (o vivirá) el Lightsail de 32 GB** que aloja plataforma+fábrica, y esa región debe ser la del grupo. RGPD → región de la UE (p. ej. `eu-west-3` París o `eu-central-1` Fráncfort). **Confirma la región del grupo antes de crear.** Cambiar de región después obliga a snapshot + recrear.
2. **Versión de PostgreSQL: 16.x.** Es la decisión correcta por **paridad CI↔producción** (D-003): dev y CI ya corren Postgres 16 (`docker-compose.dev.yml`) y la migración `core_init` se validó contra 16. Selecciona la 16.x más reciente del desplegable. Si en el futuro subes de major, súbelo **a la vez** en dev/CI y en la managed, nunca solo aquí.
3. **Acceso a la consola** con permisos de Lightsail en la cuenta AWS del grupo.
4. **El Lightsail de 32 GB no es bloqueante** para *crear* la BD, pero sí para *verificar la conexión privada* (paso 8). Puedes crear la BD en paralelo y verificar cuando el servidor exista.

## Paso a paso (consola)

### 1 · Región y arranque
- Entra a **console.aws.amazon.com/lightsail**.
- Arriba a la derecha, fija la **Región** correcta (la del grupo). Todo lo que sigue hereda esa región.
- Pestaña **Databases** → **Create database**.

### 2 · Motor y versión
- **Select a database**: `PostgreSQL`.
- **Version**: **16.x** (paridad con dev/CI, ver prerrequisito 2). Anota la versión exacta elegida.

### 3 · Zona de disponibilidad
- Elige una **AZ dentro de la región**. Preferible la misma AZ que el Lightsail de 32 GB (menor latencia); no es obligatorio para el acceso privado (basta con la región).

### 4 · Credenciales y nombre de la BD inicial (opcional "Specify login credentials")
- Deja que Lightsail **genere la contraseña maestra** (más fuerte que una a mano). Guárdala de inmediato en el gestor de secretos del grupo / SSM Parameter Store — **no** en el repo ni en Slack.
- Usuario maestro: por defecto `dbmaster` (déjalo).
- Nombre de la base inicial: p. ej. `awkplatform`. Crearemos `staging` y `production` como bases lógicas aparte en el paso 9.

### 5 · Plan
- Selecciona **Standard $30/mes → 2 GB RAM, 80 GB SSD, Data encrypted**.
- NO elijas High availability ($60) ni el de $15 (sin cifrado).

### 6 · Identificar y crear
- **Identify your database** (nombre del recurso Lightsail): p. ej. `awk-pg-prod`.
- **Create database**. Pasa a estado *Creating* → *Available* en ~10–15 min.

### 7 · Confirmar modo privado
- Abre la BD → pestaña **Networking**.
- **Public mode** debe estar **desactivado** (es el default). Así solo la alcanzan recursos Lightsail de la misma región. Déjalo así salvo necesidad puntual (import/export externo), y si lo activas, vuelve a apagarlo al terminar.

### 8 · Endpoint y prueba de conexión privada
- Pestaña **Connect**: copia **endpoint** (`ls-xxxx.xxxx.<region>.rds.amazonaws.com`), **puerto** (`5432`), usuario y contraseña.
- Desde el **Lightsail de 32 GB** (misma región), instala el cliente y prueba:
  ```bash
  sudo apt-get update && sudo apt-get install -y postgresql-client
  psql "host=<endpoint> port=5432 user=dbmaster dbname=awkplatform sslmode=require"
  ```
  Si conecta desde el servidor pero NO desde tu portátil, es la señal correcta de que el modo privado funciona.

### 9 · Bases lógicas y roles de aplicación (mínimo privilegio)
Conectado como `dbmaster`, crea una base por entorno y un rol de app por entorno (nunca uses `dbmaster` desde la aplicación):
```sql
CREATE DATABASE awkplatform_staging;
CREATE DATABASE awkplatform_production;

CREATE ROLE app_staging    LOGIN PASSWORD '<secreto-staging>';
CREATE ROLE app_production LOGIN PASSWORD '<secreto-production>';

GRANT ALL PRIVILEGES ON DATABASE awkplatform_staging    TO app_staging;
GRANT ALL PRIVILEGES ON DATABASE awkplatform_production TO app_production;
```
El rol de app **no** es superusuario — es exactamente lo que quieres para que la Row-Level Security del core (ver [05-gobernanza-seguridad](../05-gobernanza-seguridad.md)) tenga efecto.

### 10 · Ventanas de backup y mantenimiento
- En la BD → pestaña de configuración, revisa **preferred backup window** y **maintenance window**. Backups automáticos diarios + **point-in-time restore (7 días)** vienen activados por defecto en el plan Standard.

## Cadena de conexión para la plataforma (Prisma)

`DATABASE_URL` por entorno, inyectada como variable del *compose project* correspondiente, **fuera del repo** (fuente: SSM Parameter Store si se centraliza — ver [03-arquitectura](../03-arquitectura.md)):

```
# staging
postgresql://app_staging:<secreto>@<endpoint>:5432/awkplatform_staging?schema=public&sslmode=require
# production
postgresql://app_production:<secreto>@<endpoint>:5432/awkplatform_production?schema=public&sslmode=require
```

`sslmode=require` no es opcional: Lightsail sirve TLS y la app debe usarlo.

## Verificación (cerrar solo cuando todo esté ✅)

- [ ] BD en estado **Available** en la región correcta del grupo.
- [ ] Plan **Standard $30**, **Data encryption = Enabled**.
- [ ] **Public mode = Off** (privado).
- [ ] `psql` conecta **desde el Lightsail de 32 GB** y **falla desde fuera** de la red Lightsail.
- [ ] Bases `awkplatform_staging` y `awkplatform_production` creadas, con roles de app de mínimo privilegio.
- [ ] Contraseñas (maestra + roles app) guardadas en el gestor de secretos, **no** en el repo.
- [ ] **Point-in-time restore probado** una vez (requisito explícito para cerrar Fase 0, roadmap): restaura a una instancia temporal, valida, y elimínala.

## Operación posterior

- **Antes de cada migración de esquema al core**: snapshot manual (Snapshots → Create snapshot). Barato ($0.05/GB-mes) y es tu rollback.
- **Escalado**: no hay resize en caliente; se hace snapshot → crear instancia mayor desde el snapshot → repuntar `DATABASE_URL`. Corte planificado de minutos.
- **Límite de transfer**: 100 GB/mes incluidos. El tráfico privado entre recursos Lightsail de la misma región no es la preocupación; vigila import/export y dumps grandes.
- **CI/tests**: NO usan esta instancia. La BD efímera de CI corre en contenedor Postgres (D-003 / arquitectura). Esta instancia es solo staging+production.

## Referencias

- [D-004 · elección de la BD](../DECISIONES.md)
- [03 · Arquitectura — tabla de infraestructura](../03-arquitectura.md)
- [06 · Roadmap — Fase 0](../06-roadmap.md)
- Precios verificados: https://aws.amazon.com/lightsail/pricing/ (sección *Managed databases*)
