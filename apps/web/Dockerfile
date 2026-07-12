# syntax=docker/dockerfile:1
#
# Imagen del shell web (build estático de Vite servido por Nginx). Build
# context: raíz del monorepo (necesario para @awk/types, @awk/auth, @awk/ui
# workspace:*, D-009). Publicada en GHCR desde `main` vía CI (D-003).
#
# Nota (docs/03-arquitectura.md): el reverse proxy real vive en el Nginx
# nativo del host, que enruta /api al contenedor de la API. Este Nginx solo
# sirve los estáticos del shell con fallback de SPA para react-router.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY turbo.json tsconfig.base.json ./
COPY packages/types packages/types
COPY packages/auth packages/auth
COPY packages/ui packages/ui
COPY apps/web apps/web
# "pnpm exec turbo" y no "pnpm turbo": el atajo dispara el chequeo de deps de
# pnpm 11 y reinstala en modo --production a mitad de la corrida (ver STATUS).
RUN pnpm exec turbo run build --filter=...@awk/web

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
