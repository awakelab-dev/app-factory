# syntax=docker/dockerfile:1
#
# Imagen de producción del control plane de la Fábrica (apps/factory, D-030).
# Mismo patrón que apps/api/Dockerfile (D-013): build del workspace filtrado
# y `pnpm deploy --prod --legacy` para aislar @awk/factory autocontenido.
# Build context: raíz del monorepo (resuelve @awk/types y @awk/auth).
#
# El contenedor solo sirve el HTTP del control plane (lectura + gates). Los
# runners de análisis/generación NO corren aquí: necesitan PLATFORM_REPO_PATH
# (checkout dedicado del repo) y se operan por CLI (D-029) — por eso esta
# imagen no recibe ANTHROPIC_API_KEY ni monta ningún repo.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/factory/package.json apps/factory/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY turbo.json tsconfig.base.json ./
COPY packages/types packages/types
COPY packages/auth packages/auth
COPY apps/factory apps/factory
# "pnpm exec turbo" y no "pnpm turbo": el atajo dispara el chequeo de deps de
# pnpm 11 y reinstala en modo --production a mitad de la corrida (ver STATUS).
RUN pnpm exec turbo run build --filter=...@awk/factory
RUN pnpm --filter=@awk/factory deploy --prod --legacy /out/factory

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/factory ./
EXPOSE 3100
# Igual que apps/api: sin rootDir el compilado real queda en dist/src/main.js.
CMD ["node", "dist/src/main.js"]

# Imagen auxiliar "migrator" (mismo patrón que apps/api, D-016): corre
# `prisma migrate deploy` contra awkfactory_staging/production DESDE el
# Lightsail (la managed PG es privada). Sin seed: la Fábrica no siembra datos.
# Binarios directos node_modules/.bin, nunca "pnpm exec" (ver STATUS/D-016).
#
# IMPORTANTE (D-016): en CI declarar SIEMPRE `target:` explícito — sin él,
# Docker construye el ÚLTIMO stage del archivo (este), no `runtime`.
FROM build AS migrator
WORKDIR /repo/apps/factory
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]
