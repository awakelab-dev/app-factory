import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Global: todos los módulos (core y generados) auditan con el mismo servicio. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService]
})
export class AuditModule {}
