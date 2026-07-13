import { Module } from '@nestjs/common';
import { AuditModule } from './core/audit/audit.module';
import { AuthModule } from './core/auth/auth.module';
import { UsersModule } from './core/users/users.module';
import { HelloModule } from './hello/hello.module';
import { MoodleInsightsModule } from './modules/moodle-insights/moodle-insights.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Módulo raíz. El core vive en src/core/ (auth, RBAC, usuarios, audit);
 * los módulos de negocio (generados por la fábrica o, como moodle-insights,
 * el primer módulo ejemplar hecho a mano — D-020/D-021) viven en
 * src/modules/<modulo>/ (ver docs/02-stack.md).
 */
@Module({
  imports: [PrismaModule, AuditModule, AuthModule, UsersModule, HelloModule, MoodleInsightsModule]
})
export class AppModule {}
