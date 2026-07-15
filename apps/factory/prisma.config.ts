import { defineConfig } from 'prisma/config';

// Prisma 7: la URL del datasource ya no vive en schema.prisma. FACTORY_DATABASE_URL
// es una variable DISTINTA de DATABASE_URL (apps/api) — bases de datos
// separadas por diseño (D-029), aunque compartan la misma instancia managed.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: process.env.FACTORY_DATABASE_URL ?? 'postgresql://awk:awk@localhost:5432/awkfactory'
  }
});
