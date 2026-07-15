import { Module } from '@nestjs/common';
import { PipelineModule } from './pipeline/pipeline.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Contexto del CLI (src/cli.ts): solo la lógica del pipeline (D-029), sin el
 * ControlPlaneModule HTTP (D-030) — el CLI no necesita JWT ni controllers y
 * así no depende de JWT_SECRET para operar el pipeline.
 */
@Module({
  imports: [PrismaModule, PipelineModule]
})
export class CliModule {}
