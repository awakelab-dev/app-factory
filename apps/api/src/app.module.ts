import { Logger, Module, type DynamicModule } from '@nestjs/common';
import { AuditModule } from './core/audit/audit.module';
import { AuthModule } from './core/auth/auth.module';
import { RolesModule } from './core/roles/roles.module';
import { UsersModule } from './core/users/users.module';
import { HelloModule } from './hello/hello.module';
import { discoverBusinessModules, type ModuleDiscoveryResult } from './modules/modules.loader';
import { PrismaModule } from './prisma/prisma.module';

/** Módulos del core: se importan explícitamente, no son descubribles. */
const CORE_MODULES = [PrismaModule, AuditModule, AuthModule, RolesModule, UsersModule, HelloModule];

/**
 * Módulo raíz.
 *
 * Los módulos de NEGOCIO (`src/modules/<slug>/`) ya NO se listan aquí: se
 * DESCUBREN (incremento D, bloque 1 — ver `modules/modules.loader.ts`). Hasta
 * 2026-08-17 cada módulo generado por la Fábrica exigía editar este archivo a
 * mano, que es justo lo que el guardarraíl de generación le prohíbe al agente;
 * en D-049 ese cableado se entregó a medias y el módulo quedó compilando pero
 * invisible para todo el mundo. Ahora una carpeta con su `<slug>.module.ts`
 * basta.
 *
 * Por eso el raíz es un módulo DINÁMICO y se construye con
 * `await AppModule.register()`: el descubrimiento es asíncrono (`import()`, la
 * única forma que funciona igual en `dist/` y bajo vitest) y los `imports` de un
 * `@Module` tienen que estar resueltos antes de evaluar el decorador.
 *
 * moodle-insights (D-020/D-021) es el primer módulo ejemplar hecho a mano;
 * orientador-ia (D-024/D-025) el primero por el pipeline de spec intermedia;
 * reserva-salas (D-048) el primero cuyo ANÁLISIS disparó la propia Fábrica.
 */
// Los módulos del CORE van en el decorador (no en el módulo dinámico) para que
// importar `AppModule` a secas siga dando una app válida —solo sin los módulos
// de negocio— en vez de una app vacía que responda 404 a todo. Nest fusiona los
// metadatos del decorador con los del DynamicModule.
@Module({ imports: CORE_MODULES })
export class AppModule {
  static async register(): Promise<DynamicModule> {
    const discovery = await discoverBusinessModules();
    AppModule.lastDiscovery = discovery;

    if (discovery.issues.length > 0) {
      // No se lanza: un módulo mal nombrado no debe impedir que la API levante.
      // El grito queda en el log del contenedor y `modules.loader.spec.ts` lo
      // convierte en fallo de CI.
      new Logger(AppModule.name).error(
        `Descubrimiento de módulos con problemas:\n- ${discovery.issues.join('\n- ')}`
      );
    } else {
      new Logger(AppModule.name).log(
        `Módulos de negocio descubiertos (${discovery.modules.length}): ${discovery.modules
          .map((mod) => mod.name)
          .join(', ')}`
      );
    }

    return { module: AppModule, imports: discovery.modules };
  }

  /** Último descubrimiento, para que el test lo assertee. */
  static lastDiscovery: ModuleDiscoveryResult | undefined;
}
