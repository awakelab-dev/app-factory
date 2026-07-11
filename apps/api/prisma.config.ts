import { defineConfig } from 'prisma/config';

// Prisma 7: la URL del datasource ya no vive en schema.prisma ni en .env
// autocargado. Los comandos CLI (migrate, db, seed) la toman de aquí;
// el runtime la recibe vía driver adapter en PrismaService.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts'
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'postgresql://awk:awk@localhost:5432/awkplatform'
  }
});
