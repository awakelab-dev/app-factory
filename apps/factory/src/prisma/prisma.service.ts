import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Cliente Prisma de la Fábrica — base de datos SEPARADA de la Plataforma
 * (D-029: `FACTORY_DATABASE_URL`, nunca `DATABASE_URL`). Mismo patrón que
 * apps/api/src/prisma/prisma.service.ts (D-010): Prisma 7 sin engines Rust,
 * driver adapter `@prisma/adapter-pg`, conexión perezosa (se abre en la
 * primera query, no en el boot).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString:
          process.env.FACTORY_DATABASE_URL ?? 'postgresql://awk:awk@localhost:5432/awkfactory'
      })
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
