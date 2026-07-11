import { defineConfig } from 'prisma/config';

// Prisma 7 ya no carga .env automáticamente: la URL del datasource para los
// comandos CLI (migrate, db) se define aquí, leyendo del entorno.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://awk:awk@localhost:5432/awkplatform?schema=core'
  }
});
