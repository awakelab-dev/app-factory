# Runbook — Alta de una cuenta Claude (Centro de Costo) y de sus usuarios

Modelo aprobado por Gerencia el 2026-07-26 (D-044, docs/04): **~4 cuentas Claude, una por Centro de Costo**; el admin de cada una activa los permisos **una sola vez**; las personas se provisionan **centralmente** desde Sistemas. Superficie única: **Cowork**. Git solo dentro de Sistemas.

## Parte 1 — Alta de la cuenta (admin del Centro de Costo, 1 vez)

Se le entrega al admin el one-pager `docs/onboarding/one-pager-admin-cuenta.html` (imprimible/enviable). Resumen de lo que hace:

1. **Habilitar el conector** de la Fábrica para el equipo: Organization settings → Connectors → Add → Custom → Web.
   - **URL (producción)**: `https://apps.awakelab.world/factory-api/mcp`
   - **URL (pruebas)**: `https://staging.apps.awakelab.world/factory-api/mcp`
   - **No hace falta Client ID/Secret**: el cliente se auto-registra por DCR (RFC 7591). Si la interfaz los exigiera igualmente, usar el cliente pre-registrado `claude` + el `FACTORY_OAUTH_CLIENT_SECRET` del `.env` del entorno (lo entrega Sistemas por canal seguro).
2. **Habilitar plugins/skills** para el equipo y, si el plan lo permite, añadir el plugin `awk-prototipo` como fuente gestionada de la organización (así los usuarios no instalan nada). Si no lo permite, Sistemas distribuye el archivo `.plugin` (ver §3).
3. Confirmar a Sistemas que quedó activo, indicando **qué usuarios** del Centro de Costo deben quedar habilitados.

> Estas 3 acciones son **por cuenta**, no por usuario. Con 4 cuentas, son 4 altas en total.

## Parte 2 — Provisionar a cada persona (Sistemas y Desarrollo)

Perfiles habilitados (D-044): gerentes, líderes, supervisores y analistas → todos con rol `gerente`.

> **Puerto 15432**, no 5433 (corregido 2026-08-15, D-046): es el que lleva el `FACTORY_DATABASE_URL` real de `apps/factory/.env`. Con 5433 el túnel levanta pero el CLI no conecta, y el fallo aparece envuelto en un error de Prisma que no menciona la conexión.
```bash
# Terminal A — túnel a la managed PG (dejar abierto).
# <ENDPOINT>/<PASS> salen de FACTORY_DATABASE_URL en /opt/awkfactory/<entorno>/.env
ssh -N -L 15432:<ENDPOINT>:5432 AWK-Dev

# Terminal B — desde el repo
export FACTORY_DATABASE_URL='postgresql://app_factory_<entorno>:<PASS>@localhost:15432/awkfactory_<entorno>?sslmode=require&uselibpqcompat=true'
pnpm --filter=@awk/factory run cli -- create-actor --email <persona>@<dominio> --role gerente
pnpm --filter=@awk/factory run cli -- set-password --email <persona>@<dominio>   # prompt oculto, mín. 12
```

- Entregar la contraseña inicial por **canal seguro** (gestor de contraseñas), nunca por email/chat en claro. Reset: repetir `set-password`.
- **Baja**: `revoke-actor --email <persona>@<dominio>` — corta el acceso aunque conserve el plugin instalado.
- Staging y producción tienen **BDs separadas**: provisionar en cada entorno donde la persona deba entrar.

## Parte 3 — El usuario, en Cowork

1. Si el plugin no viene gestionado por la cuenta: Sistemas le pasa el archivo `.plugin` y lo sube desde Cowork (botón "Save plugin").
   ```bash
   cd plugins/awk-prototipo && zip -r /tmp/awk-prototipo.plugin . -x "*.DS_Store"
   ```
2. Al primer uso del conector, Claude abre el navegador → **login con el email y la contraseña de la Fábrica** (Parte 2) → consentimiento.
3. **ÉXITO** = conector conectado + tools visibles + "¿qué módulos existen?" responde.

Uso cotidiano (lenguaje natural, sin comandos técnicos): crear prototipo → "enviala a la Fábrica" → "¿cómo va mi proyecto?" → "agregale X al módulo Y".

## Parte 4 — Prototipos de externos / cuentas personales

No se les habilita conector. Entregan el **código fuente** al Departamento de Sistemas, que abre el proyecto y lo ingresa al pipeline a nombre del solicitante (por CLI o desde una sesión propia de Cowork). Toda la gobernanza (gates docs/05) aplica igual.

## Diagnóstico rápido

| Síntoma | Causa |
|---|---|
| *Install* del conector deshabilitado ("Contact an organization owner") | Falta la Parte 1: el admin de esa cuenta no habilitó el conector. |
| Login OK pero **403** al usar las tools | La persona no tiene fila **activa** en `factory_actors` (Parte 2) o está en el entorno equivocado (staging vs producción). |
| Login siempre rechazado | Falta `set-password`, o contraseña vieja — reponer por CLI. |
| `invalid_client` al conectar | DCR no habilitado en ese entorno, o el conector se dio de alta con un Client ID que no existe. |

Detalle técnico del conector y del AS: `docs/runbooks/plugin-awk-prototipo.md` y `docs/runbooks/oauth-conector-as-propio.md`.
