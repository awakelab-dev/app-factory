# Runbook · Migración de dominio (wiloxagency.com → apps.awakelab.world)

> Runbook operativo de un solo uso. Ejecuta **D-018** sobre el Lightsail de
> cómputo **ya provisionado y con D-016/D-017 corriendo en producción real**
> (staging y production sirviendo por HTTPS en `staging.factory.wiloxagency.com`
> / `production.factory.wiloxagency.com`). No es un deploy desde cero — para
> eso ver `docs/runbooks/lightsail-deploy.md` (ya actualizado a los dominios
> nuevos para cualquier reconstrucción futura).
>
> **Por qué es manual**: el sandbox de Cowork no tiene ruta de red al
> Lightsail (mismo motivo que en `lightsail-deploy.md`). Los pasos los
> ejecuta Leonardo por SSH desde su Mac.

## Punto de partida

- DNS de `staging.apps.awakelab.world` y `apps.awakelab.world` **ya apuntan**
  (registro A) a `13.38.161.213` — confirmado por Leonardo antes de este
  runbook, no hace falta re-verificarlo en el paso 1.
- Los server blocks viejos siguen activos y sirviendo tráfico real: no los
  toques hasta el paso 4 (una vez verificado el dominio nuevo).
- Los archivos `deploy/nginx/staging.conf` y `deploy/nginx/production.conf`
  del repo ya están actualizados a los dominios nuevos (D-018) — son los que
  se copian en el paso 1.

## 1 · Copiar los server blocks nuevos (dominios nuevos, en paralelo a los viejos)

```bash
# desde tu Mac, con el repo actualizado (git pull):
scp deploy/nginx/staging.conf    AWK-Dev:~/staging.apps.awakelab.world
scp deploy/nginx/production.conf AWK-Dev:~/apps.awakelab.world

# ya en el server:
sudo mv ~/staging.apps.awakelab.world /etc/nginx/sites-available/staging.apps.awakelab.world
sudo mv ~/apps.awakelab.world         /etc/nginx/sites-available/apps.awakelab.world
sudo ln -s /etc/nginx/sites-available/staging.apps.awakelab.world /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/apps.awakelab.world         /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

En este punto los dominios viejos y nuevos coexisten, ambos por HTTP (80),
ambos apuntando a los mismos puertos `127.0.0.1` que ya están arriba —
cero downtime, nada se corta todavía.

## 2 · Certificados nuevos (certbot, dominios nuevos)

```bash
sudo certbot --nginx -d staging.apps.awakelab.world
sudo certbot --nginx -d apps.awakelab.world
```

Certbot añade el bloque 443 + redirect 80→443 a cada server block nuevo,
igual que hizo con los viejos en D-016. Si algún comando falla con "domain
did not resolve" o similar, el DNS aún no propagó del todo pese a lo
confirmado arriba — espera unos minutos y reintenta antes de seguir.

## 3 · Verificar el dominio nuevo (sin tocar el viejo todavía)

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://staging.apps.awakelab.world/api/hello   # 200
curl -s -o /dev/null -w '%{http_code}\n' https://staging.apps.awakelab.world              # 200, shell web
curl -s -o /dev/null -w '%{http_code}\n' https://apps.awakelab.world/api/hello            # 200 (o 403 si dev-login, ver nota)
```

Dev-login contra staging con el dominio nuevo (mismo check que D-017, ahora
sobre `staging.apps.awakelab.world`):

```bash
curl -s -X POST https://staging.apps.awakelab.world/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"leonardo.barreto@awakelab.dev"}'
# esperado: 200 + JWT
```

No sigas al paso 4 hasta que estos tres checks den lo esperado.

## 4 · Retirar los server blocks y certificados del dominio viejo

Una vez confirmado el paso 3, ya nada depende del dominio viejo — retíralo:

```bash
sudo rm /etc/nginx/sites-enabled/staging.factory.wiloxagency.com
sudo rm /etc/nginx/sites-enabled/production.factory.wiloxagency.com
sudo rm /etc/nginx/sites-available/staging.factory.wiloxagency.com
sudo rm /etc/nginx/sites-available/production.factory.wiloxagency.com
sudo nginx -t && sudo systemctl reload nginx

# revoca y borra los certificados viejos (evita renovaciones automáticas
# fallidas de certbot sobre un dominio que ya no se sirve):
sudo certbot delete --cert-name staging.factory.wiloxagency.com
sudo certbot delete --cert-name production.factory.wiloxagency.com
```

## 5 · Confirmar que el dominio viejo ya no responde

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://staging.factory.wiloxagency.com/api/hello
```

Con el server block borrado, esto debe fallar la conexión TLS (ya no hay
certificado ni vhost para ese `server_name`) o caer al `default_server` del
host si existe uno — en ningún caso debe seguir sirviendo la plataforma.

## 6 · GitHub Actions / GitHub Secrets

Sin cambios: `LIGHTSAIL_HOST` sigue siendo la IP `13.38.161.213` (no cambió
el server, solo el dominio público), y `.github/workflows/deploy.yml` no
referencia el dominio en ningún paso — el deploy automático a staging tras
CI verde en `main` sigue funcionando igual, sin tocar nada aquí.

## 7 · Checklist final (cerrar solo cuando todo ✅)

- [ ] `https://staging.apps.awakelab.world/api/hello` → 200 por HTTPS.
- [ ] `https://staging.apps.awakelab.world` sirve el shell web.
- [ ] Dev-login funciona contra el dominio nuevo de staging.
- [ ] `https://apps.awakelab.world/api/hello` → 200 (production).
- [ ] Server blocks y certificados del dominio viejo retirados; el dominio
      viejo ya no sirve la plataforma.
- [ ] Un deploy real (push a `main` con CI verde) llega a staging por el
      dominio nuevo sin cambios en `deploy.yml` ni en GitHub Secrets.
- [ ] `docs/STATUS.md` actualizado con el resultado real de este runbook.

## Referencias

- [D-018](../DECISIONES.md) (esta migración), [D-016](../DECISIONES.md),
  [D-017](../DECISIONES.md) (deploy original sobre el dominio viejo)
- [lightsail-deploy.md](lightsail-deploy.md) — ya actualizado a los dominios
  nuevos para cualquier reconstrucción futura del server
