# Runbook · Deploy de la plataforma en el Lightsail de cómputo

> Runbook operativo. Ejecuta D-003/D-013/D-015/**D-016** sobre el Lightsail de
> 32 GB **existente y compartido** del grupo (Nginx nativo + certbot + pm2 +
> otras apps; no se toca nada de eso). Última revisión: 2026-07-12.
>
> **Por qué este runbook es manual y no lo corrió Claude directamente**: el
> sandbox de Cowork corre en una red aislada con proxy/allowlist — no tiene
> ruta TCP directa a `13.38.161.213:22` (verificado: `Network is unreachable`).
> Los pasos de esta página los ejecuta Leonardo por SSH normal desde su Mac.
> Una vez configurados los GitHub Secrets (paso 7), los deploys *sucesivos*
> sí son automáticos (GitHub Actions corre en runners con salida a
> internet normal, no en este sandbox).

## Qué existe ya (no crear de nuevo)

- Docker Engine 29.6.1 + Compose v2 instalados (D-015).
- Lightsail managed PostgreSQL 18.4 en `eu-west-3`, modo privado, bases
  `awkplatform_staging` y `awkplatform_production` creadas (ver
  `docs/runbooks/lightsail-postgres.md`). Faltan los roles de app (paso 5).
- Nginx nativo + certbot ya en uso por otras apps del grupo — solo se
  **añaden** server blocks nuevos, sin tocar los existentes.

## Dominios y puertos de esta tarea

| Entorno | Dominio | API (host) | Web (host) |
|---|---|---|---|
| staging | `staging.factory.wiloxagency.com` | 127.0.0.1:18100 | 127.0.0.1:18101 |
| production | `production.factory.wiloxagency.com` | 127.0.0.1:18102 | 127.0.0.1:18103 |

Los puertos 18100-18103 son una elección "poco común" **a confirmar** en el
paso 1 — no chocan con nada conocido, pero nadie con acceso al server los
verificó contra el uso real de pm2/Nginx antes de escribir este runbook.
Los contenedores se publican solo en `127.0.0.1` (no en la interfaz
pública): el único camino de entrada es el Nginx del host.

## 0 · Autorizar la deploy key

Se generó un par de llaves **dedicado solo a este deploy** (no reutiliza
ninguna llave personal). La pública debe añadirse al server; la privada se
guarda como GitHub Secret (paso 7), nunca en el repo.

Clave pública a autorizar (usuario `ubuntu`):

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILbOASwI0mV1bbHB1UxvDCoGAocyQDnI2r35kbEPt/UF awk-deploy@lightsail
```

En el server:

```bash
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILbOASwI0mV1bbHB1UxvDCoGAocyQDnI2r35kbEPt/UF awk-deploy@lightsail" >> ~/.ssh/authorized_keys
```

La llave privada correspondiente se entrega junto con este runbook (archivo
`awk_deploy_ed25519`, fuera del repo) — solo úsala para el GitHub Secret del
paso 7 y luego bórrala de donde la hayas copiado.

## 1 · Confirmar puertos libres

```bash
ss -tlnp | grep -E ':(18100|18101|18102|18103)\b' || echo "libres"
```

Si alguno está ocupado, cambia `API_PORT_HOST`/`WEB_PORT_HOST` en el `.env`
del entorno correspondiente (paso 3) — **no** en `deploy/docker-compose.yml`
ni en los server blocks sin actualizar ambos a la vez.

## 2 · Estructura de directorios

```bash
sudo mkdir -p /opt/awkfactory/staging /opt/awkfactory/production
sudo chown ubuntu:ubuntu /opt/awkfactory/staging /opt/awkfactory/production
```

Copia el compose (idéntico para ambos entornos, sin secretos) a los dos:

```bash
# desde tu Mac, con el repo ya clonado:
scp deploy/docker-compose.yml AWK-Dev:/opt/awkfactory/staging/docker-compose.yml
scp deploy/docker-compose.yml AWK-Dev:/opt/awkfactory/production/docker-compose.yml
```

## 3 · Secretos por entorno (`.env`, fuera del repo)

Parte de `deploy/staging.env.example` y `deploy/production.env.example`
(están en el repo, sin secretos reales). En el server:

```bash
# staging
cp deploy/staging.env.example /opt/awkfactory/staging/.env   # si trabajas desde el repo clonado en el server
# o pégalo a mano con: nano /opt/awkfactory/staging/.env
```

Rellena en cada `.env`:
- `DATABASE_URL`: con el rol `app_staging` / `app_production` (paso 5) y el
  endpoint real de la managed (`docs/runbooks/lightsail-postgres.md`).
- `JWT_SECRET`: `openssl rand -base64 48` — **distinto** en cada entorno.
- Puertos confirmados en el paso 1.

`chmod 600` a ambos `.env` (contienen credenciales de BD):

```bash
chmod 600 /opt/awkfactory/staging/.env /opt/awkfactory/production/.env
```

## 4 · Autenticar el server contra GHCR

Verifica primero si ya hay credenciales guardadas:

```bash
cat ~/.docker/config.json 2>/dev/null | grep -q ghcr.io && echo "ya autenticado" || echo "falta login"
```

Si falta: crea un PAT de GitHub (Settings → Developer settings → Personal
access tokens → **classic**, scope únicamente `read:packages`) del usuario
que tiene acceso a `awakelab-dev/app-factory`, y:

```bash
docker login ghcr.io -u <tu-usuario-github> -p <PAT>
```

Este login persiste en `~/.docker/config.json` del usuario `ubuntu` — no
hace falta repetirlo en cada deploy (ni pasarlo por los workflows de CI).

## 5 · Roles de app en la managed PostgreSQL

Si `docs/runbooks/lightsail-postgres.md` paso 9 aún no se ejecutó, hazlo
ahora (conectado como `dbmasteruser` a la base `postgres`):

```sql
CREATE ROLE app_staging    LOGIN PASSWORD '<secreto-staging>';
CREATE ROLE app_production LOGIN PASSWORD '<secreto-production>';

GRANT ALL PRIVILEGES ON DATABASE awkplatform_staging    TO app_staging;
GRANT ALL PRIVILEGES ON DATABASE awkplatform_production TO app_production;
```

Usa esos mismos secretos en los `DATABASE_URL` del paso 3.

## 6 · Primer arranque + migración de staging

```bash
cd /opt/awkfactory/staging
docker compose --env-file .env -p awk-staging pull
docker compose --env-file .env -p awk-staging up -d
docker compose -p awk-staging ps   # ambos healthy
```

Migración + seed (primera vez, imagen "migrator" de GHCR — ver D-016):

```bash
# copia deploy/scripts/migrate.sh al server (o clona el repo ahí) y:
./migrate.sh staging latest --seed
```

Verifica sin pasar aún por Nginx:

```bash
curl -s http://127.0.0.1:18100/api/hello   # health público, 200
curl -s http://127.0.0.1:18101/health      # web, "ok"
```

## 7 · Nginx + certbot para los dominios nuevos

```bash
sudo cp deploy/nginx/staging.conf /etc/nginx/sites-available/staging.factory.wiloxagency.com
sudo ln -s /etc/nginx/sites-available/staging.factory.wiloxagency.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d staging.factory.wiloxagency.com
```

Repite para producción con `deploy/nginx/production.conf` y
`production.factory.wiloxagency.com` (el compose de producción puede
quedar arriba sin tráfico real hasta la primera promoción — pasos 2-4 y
Nginx/certbot sí conviene dejarlos listos ahora).

DNS: confirma que ambos subdominios de `factory.wiloxagency.com` ya
apuntan (registro A) a `13.38.161.213` antes de pedir el certificado —
certbot falla si el dominio no resuelve al server.

## 8 · GitHub Secrets para el deploy automático

En `awakelab-dev/app-factory` → Settings → Secrets and variables → Actions:

| Secret | Valor |
|---|---|
| `LIGHTSAIL_HOST` | `13.38.161.213` |
| `LIGHTSAIL_SSH_USER` | `ubuntu` |
| `LIGHTSAIL_SSH_KEY` | contenido completo de la llave **privada** `awk_deploy_ed25519` (paso 0) |

Con esto, `.github/workflows/deploy.yml` despliega **staging automáticamente**
cada vez que `CI` termina en verde sobre `main`. Producción se promueve a
mano: Actions → **Deploy** → *Run workflow* → `image_tag` = el `sha` que ya
se validó en staging.

## 9 · Verificación final (cerrar solo cuando todo ✅)

- [ ] `https://staging.factory.wiloxagency.com/api/hello` responde 200 por HTTPS.
- [ ] `https://staging.factory.wiloxagency.com` sirve el shell web.
- [ ] Dev-login (`POST /api/auth/dev-login`) funciona contra staging con
      `leonardo.barreto@awakelab.dev` (admin) — confirma que apunta a la
      managed real, no a un Postgres local.
- [ ] `docker compose -p awk-staging ps` → ambos servicios `healthy`.
- [ ] Push a `main` dispara `Deploy` → job `staging` en verde sin intervención.
- [ ] Producción: estructura y Nginx listos; primera promoción manual
      ejecutada y verificada igual que staging.
- [ ] `docs/STATUS.md` actualizado con el resultado real (dominios, puertos
      confirmados, cualquier desvío de este runbook).

## Referencias

- [D-003](../DECISIONES.md), [D-013](../DECISIONES.md), [D-015](../DECISIONES.md), D-016 (este runbook)
- [03 · Arquitectura](../03-arquitectura.md)
- [lightsail-postgres.md](lightsail-postgres.md) — roles de app y `DATABASE_URL`
