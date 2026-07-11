import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Cliente Prisma como servicio Nest (Prisma 7, sin engines Rust: las queries
 * van por el driver adapter de pg). Conexión perezosa a propósito: se abre en
 * la primera query, no en el boot — así los tests y endpoints públicos
 * funcionan sin BD levantada.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString:
          process.env.DATABASE_URL ?? 'postgresql://awk:awk@localhost:5432/awkplatform'
      })
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
