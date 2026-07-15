#!/usr/bin/env bash
# Como migrate.sh pero para la BD de la FÁBRICA (apps/factory, D-029/D-030):
# usa la imagen awkplatform-factory-migrator y FACTORY_DATABASE_URL (leída
# del mismo .env del entorno). Sin seed: la Fábrica no siembra datos.
# Se ejecuta DESDE el Lightsail de cómputo (la managed PG es privada).
#
# Uso:
#   ./migrate-factory.sh staging    <tag>
#   ./migrate-factory.sh production <tag>
set -euo pipefail

ENV_NAME="${1:?Uso: migrate-factory.sh <staging|production> <tag>}"
TAG="${2:?Uso: migrate-factory.sh <staging|production> <tag>}"

case "$ENV_NAME" in
  staging|production) ;;
  *) echo "Entorno inválido: $ENV_NAME (usa staging o production)"; exit 1 ;;
esac

ENV_FILE="/opt/awkfactory/${ENV_NAME}/.env"
[ -f "$ENV_FILE" ] || { echo "No existe ${ENV_FILE}"; exit 1; }

IMAGE="ghcr.io/awakelab-dev/awkplatform-factory-migrator:${TAG}"
docker pull "$IMAGE"

# Binarios directos (node_modules/.bin), NUNCA "pnpm exec ..." — ver migrate.sh.
docker run --rm --env-file "$ENV_FILE" "$IMAGE" node_modules/.bin/prisma migrate deploy

echo "Migración de la Fábrica (${ENV_NAME} @ ${TAG}) completada."
