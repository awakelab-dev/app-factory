import { Module } from '@nestjs/common';
import { HelloModule } from './hello/hello.module';

/**
 * Módulo raíz. El core (auth, RBAC, usuarios, audit) se añade en el
 * siguiente paso de Fase 0; los módulos de negocio generados por la
 * fábrica vivirán en src/modules/<modulo>/ (ver docs/02-stack.md).
 */
@Module({
  imports: [HelloModule]
})
export class AppModule {}
