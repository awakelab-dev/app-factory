import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PipelineModule } from '../pipeline/pipeline.module';
import { getJwtSecret } from './auth.constants';
import { ChangeRequestsController } from './change-requests.controller';
import { FactoryAuthGuard } from './factory-auth.guard';
import { GatesController } from './gates.controller';
import { HealthController } from './health.controller';
import { McpController } from './mcp.controller';
import { ModulesController } from './modules.controller';
import { ProjectsController } from './projects.controller';
import { SubmissionsController } from './submissions.controller';

/**
 * Control plane HTTP de la Fábrica (D-030, paso 2 de D-026): controllers de
 * lectura + decisión de gates SOBRE los servicios de PipelineModule (D-029),
 * sin tocarlos. Guard global: toda la superficie exige JWT de plataforma con
 * rol admin O un PAT de factory_actors (D-036), salvo /health.
 *
 * Desde D-036 (incremento A de Fase 2) también monta la superficie del
 * conector Cowork: GET /modules, POST /submissions, POST /change-requests y
 * el MCP server Streamable HTTP en /factory-api/mcp (mismos servicios,
 * mismo guard — el MCP es solo otro transporte sobre el mismo contrato).
 *
 * En el contexto de CLI (createApplicationContext, src/cli.ts) este módulo
 * no se carga: los guards/controllers no existen ahí.
 */
@Module({
  imports: [PipelineModule, JwtModule.register({ secret: getJwtSecret() })],
  controllers: [
    HealthController,
    ProjectsController,
    GatesController,
    ModulesController,
    SubmissionsController,
    ChangeRequestsController,
    McpController
  ],
  providers: [{ provide: APP_GUARD, useClass: FactoryAuthGuard }]
})
export class ControlPlaneModule {}
