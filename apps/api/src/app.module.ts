import { Module } from '@nestjs/common';
import { AuditModule } from './core/audit/audit.module';
import { AuthModule } from './core/auth/auth.module';
import { UsersModule } from './core/users/users.module';
import { HelloModule } from './hello/hello.module';
import { MoodleInsightsModule } from './modules/moodle-insights/moodle-insights.module';
import { OrientadorIaModule } from './modules/orientador-ia/orientador-ia.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Módulo raíz. El core vive en src/core/ (auth, RBAC, usuarios, audit);
 * los módulos de negocio (generados por la fábrica o, como moodle-insights,
 * el primer módulo ejemplar hecho a mano — D-020/D-021) viven en
 * src/modules/<modulo>/ (ver docs/02-stack.md). orientador-ia (D-024/D-025)
 * es el primer caso ejercitado con el pipeline de spec intermedia de Fase 1.
 */
@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    HelloModule,
    MoodleInsightsModule,
    OrientadorIaModule
  ]
})
export class AppModule {}
