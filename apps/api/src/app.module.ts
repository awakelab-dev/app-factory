import { Module } from '@nestjs/common';
import { AuditModule } from './core/audit/audit.module';
import { AuthModule } from './core/auth/auth.module';
import { UsersModule } from './core/users/users.module';
import { HelloModule } from './hello/hello.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Módulo raíz. El core vive en src/core/ (auth, RBAC, usuarios, audit);
 * los módulos de negocio generados por la fábrica vivirán en
 * src/modules/<modulo>/ (ver docs/02-stack.md).
 */
@Module({
  imports: [PrismaModule, AuditModule, AuthModule, UsersModule, HelloModule]
})
export class AppModule {}
