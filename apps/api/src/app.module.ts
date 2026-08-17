import { Module } from '@nestjs/common';
import { AuditModule } from './core/audit/audit.module';
import { AuthModule } from './core/auth/auth.module';
import { UsersModule } from './core/users/users.module';
import { HelloModule } from './hello/hello.module';
import { FocusFlowModule } from './modules/focus-flow/focus-flow.module';
import { GestorProyectosModule } from './modules/gestor-proyectos/gestor-proyectos.module';
import { IncidenciasAulaModule } from './modules/incidencias-aula/incidencias-aula.module';
import { MoodleInsightsModule } from './modules/moodle-insights/moodle-insights.module';
import { OrientadorIaModule } from './modules/orientador-ia/orientador-ia.module';
import { ReservaSalasModule } from './modules/reserva-salas/reserva-salas.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Módulo raíz. El core vive en src/core/ (auth, RBAC, usuarios, audit);
 * los módulos de negocio (generados por la fábrica o, como moodle-insights,
 * el primer módulo ejemplar hecho a mano — D-020/D-021) viven en
 * src/modules/<modulo>/ (ver docs/02-stack.md). orientador-ia (D-024/D-025)
 * es el primer caso ejercitado con el pipeline de spec intermedia de Fase 1.
 * reserva-salas (D-048) es el primero cuyo ANÁLISIS lo disparó la propia
 * Fábrica al recibir el prototipo, sin que nadie lanzara un comando.
 */
@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    HelloModule,
    MoodleInsightsModule,
    OrientadorIaModule,
    GestorProyectosModule,
    FocusFlowModule,
    IncidenciasAulaModule,
    ReservaSalasModule
  ]
})
export class AppModule {}
