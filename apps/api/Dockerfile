# syntax=docker/dockerfile:1
#
# Imagen de producción de la API (NestJS). Build context: raíz del monorepo
# (necesario para resolver los paquetes workspace:* @awk/types y @awk/auth,
# D-009). Publicada en GHCR desde `main` vía CI (D-003).
#
# Estrategia: se instala y compila el workspace completo (necesario porque
# @awk/api depende de @awk/types y @awk/auth), y luego `pnpm deploy` aísla
# @awk/api en un directorio autocontenido (solo dependencias de producción,
# sin symlinks de pnpm) que se copia tal cual a la imagen final. Los paquetes
# workspace declaran "files": ["dist"] para que `pnpm deploy` incluya su
# build aunque dist/ esté en .gitignore.

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
COPY apps/api apps/api
# "pnpm exec turbo" y no "pnpm turbo": el atajo dispara el chequeo de deps de
# pnpm 11 y reinstala en modo --production a mitad de la corrida (ver STATUS).
RUN pnpm exec turbo run build --filter=...@awk/api
# --legacy: pnpm 10+ por defecto exige "inject-workspace-packages=true" para
# deploy sin ese flag (ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE); no lo tenemos
# configurado y no hace falta — legacy resuelve @awk/types y @awk/auth igual
# de bien copiándolos desde el store de contenido (verificado localmente).
RUN pnpm --filter=@awk/api deploy --prod --legacy /out/api

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/api ./
EXPOSE 3000
# nest build no aplana a dist/main.js (no hay rootDir): el compilado real
# preserva la carpeta src (dist/src/main.js). Ver STATUS "Resuelto recientemente".
CMD ["node", "dist/src/main.js"]

# Imagen auxiliar "migrator": reutiliza el stage `build` (workspace completo,
# con prisma CLI y tsx como devDependencies de @awk/api, D-013) para correr
# `prisma migrate deploy` (+ seed) contra staging/production DESDE el
# Lightsail de cómputo, sin instalar Node/pnpm en el host ni clonar el repo
# ahí (la managed PG es privada, ver docs/runbooks/lightsail-deploy.md). Se
# publica en GHCR con el mismo tag que awkplatform-api para garantizar que
# las migraciones corresponden exactamente al código desplegado.
#
# IMPORTANTE: invocar los binarios directos vía node_modules/.bin, nunca
# "pnpm exec ..." ni "pnpm <script>" aquí dentro. En este workspace, "pnpm
# exec" dispara el chequeo de deps de pnpm 11 (el mismo de la nota de
# "pnpm turbo" en STATUS.md/D-013) y, sin TTY, termina reinstalando en modo
# --production a mitad de la corrida — borra prisma/tsx (devDependencies)
# justo antes de usarlos. Reproducido en el Lightsail real (2026-07-12).
FROM build AS migrator
WORKDIR /repo/apps/api
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]
