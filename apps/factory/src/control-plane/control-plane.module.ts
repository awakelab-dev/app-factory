import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PipelineModule } from '../pipeline/pipeline.module';
import { getJwtSecret } from './auth.constants';
import { FactoryAuthGuard } from './factory-auth.guard';
import { GatesController } from './gates.controller';
import { HealthController } from './health.controller';
import { ProjectsController } from './projects.controller';

/**
 * Control plane HTTP de la Fábrica (D-030, paso 2 de D-026): controllers de
 * lectura + decisión de gates SOBRE los servicios de PipelineModule (D-029),
 * sin tocarlos. Guard global: toda la superficie exige JWT de plataforma con
 * rol admin (ver factory-auth.guard.ts), salvo /health.
 *
 * En el contexto de CLI (createApplicationContext, src/cli.ts) este módulo
 * no se carga: los guards/controllers no existen ahí.
 */
@Module({
  imports: [PipelineModule, JwtModule.register({ secret: getJwtSecret() })],
  controllers: [HealthController, ProjectsController, GatesController],
  providers: [{ provide: APP_GUARD, useClass: FactoryAuthGuard }]
})
export class ControlPlaneModule {}
