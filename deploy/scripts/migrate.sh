#!/usr/bin/env bash
# Corre `prisma migrate deploy` (+ opcionalmente seed) contra staging o
# production usando la imagen "migrator" publicada en GHCR (mismo tag que
# awkplatform-api, ver apps/api/Dockerfile stage `migrator` y D-013/D-016).
# Se ejecuta DESDE el Lightsail de cómputo: la managed PG es privada
# (docs/runbooks/lightsail-postgres.md) y este host sí tiene ruta a ella.
#
# Uso:
#   ./migrate.sh staging    <tag>            # solo migraciones
#   ./migrate.sh staging    <tag> --seed      # migraciones + seed (primera vez)
#   ./migrate.sh production <tag>
set -euo pipefail

ENV_NAME="${1:?Uso: migrate.sh <staging|production> <tag> [--seed]}"
TAG="${2:?Uso: migrate.sh <staging|production> <tag> [--seed]}"
SEED="${3:-}"

case "$ENV_NAME" in
  staging|production) ;;
  *) echo "Entorno inválido: $ENV_NAME (usa staging o production)"; exit 1 ;;
esac

ENV_FILE="/opt/awkfactory/${ENV_NAME}/.env"
[ -f "$ENV_FILE" ] || { echo "No existe ${ENV_FILE}"; exit 1; }

IMAGE="ghcr.io/awakelab-dev/awkplatform-api-migrator:${TAG}"
docker pull "$IMAGE"

RUN_CMD="pnpm exec prisma migrate deploy"
if [ "$SEED" = "--seed" ]; then
  RUN_CMD="${RUN_CMD} && pnpm exec tsx prisma/seed.ts"
fi

# CI=true: pnpm 11 corre un chequeo de deps antes de "exec" y, sin TTY (como
# aquí), aborta con ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY al intentar
# purgar node_modules para "arreglarlo". CI=true lo vuelve no interactivo.
docker run --rm -e CI=true --env-file "$ENV_FILE" "$IMAGE" sh -c "$RUN_CMD"

echo "Migración (${ENV_NAME} @ ${TAG}) completada."
