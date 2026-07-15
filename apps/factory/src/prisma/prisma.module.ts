import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Global: cualquier servicio del pipeline inyecta PrismaService sin reimportar. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService]
})
export class PrismaModule {}
