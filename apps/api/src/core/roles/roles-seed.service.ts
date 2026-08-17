import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { ROLES_KEY } from '../auth/auth.constants';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Roles base de la plataforma, con descripción escrita a mano (los de módulo se
 * describen solos, ver más abajo). Estaban solo en `prisma/seed.ts`, que no
 * corre en cada despliegue: sembrarlos aquí hace que una BD nueva arranque
 * usable sin `--seed`.
 */
const BASE_ROLES: ReadonlyArray<{ name: string; description: string }> = [
  { name: 'admin', description: 'Administración de la plataforma (core y todos los módulos)' },
  { name: 'user', description: 'Usuario estándar de la plataforma' }
];

/**
 * Siembra automática de roles (incremento D, bloque 2).
 *
 * El problema, en palabras de D-049: un módulo nuevo nace **invisible** hasta
 * que alguien mete SQL a mano, porque los roles que declara (`@Roles()` en la
 * API, `requiredRoles` en el manifest) no existen como filas de `core.roles`.
 * Ya pasó dos módulos seguidos: `incidencias-aula` y `reserva-salas`.
 *
 * De dónde sale la lista: **de los propios `@Roles()`**, escaneando los
 * controllers registrados. La fuente es el código que HACE CUMPLIR el rol, así
 * que por construcción no puede existir un `@Roles('x')` sin que `x` sea
 * asignable. La alternativa era mover los manifests de web a un paquete
 * compartido para leer `requiredRoles`: más declarativo, pero obliga a tocar
 * los ocho manifests y a ampliar el guardarraíl de generación (2026-08-17).
 *
 * `update: {}` en el upsert: nunca pisa la descripción de un rol que ya existe
 * (las buenas descripciones de `seed.ts` se conservan).
 */
@Injectable()
export class RolesSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RolesSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly discovery: DiscoveryService,
    private readonly metadataScanner: MetadataScanner
  ) {}

  /**
   * `onApplicationBootstrap` y no `onModuleInit`: corre cuando TODOS los módulos
   * (incluidos los de negocio descubiertos) ya están registrados.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const seeded = await this.seed();
      this.logger.log(
        `Roles sembrados/verificados: ${seeded.length} (${seeded.join(', ')}). ` +
          'Recuerda: los roles viajan en el JWT — un usuario con sesión abierta debe volver a entrar para que un rol nuevo le haga efecto.'
      );
    } catch (error) {
      // La API arranca igual: una API que no levanta es peor que un rol sin
      // sembrar. El grito queda en el log del contenedor.
      this.logger.error(
        `NO se pudieron sembrar los roles (los módulos que los exijan quedarán invisibles hasta que se siembren): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /** Roles declarados en `@Roles()` por cualquier controller registrado. */
  collectDeclaredRoles(): Map<string, string[]> {
    const byRole = new Map<string, string[]>();
    const add = (role: string, source: string) => {
      const sources = byRole.get(role) ?? [];
      if (!sources.includes(source)) sources.push(source);
      byRole.set(role, sources);
    };

    for (const wrapper of this.discovery.getControllers()) {
      const metatype = wrapper.metatype;
      if (typeof metatype !== 'function') continue;
      const source = metatype.name;

      for (const role of this.rolesOf(metatype)) add(role, source);

      const prototype = metatype.prototype as object | undefined;
      if (!prototype) continue;
      for (const methodName of this.metadataScanner.getAllMethodNames(prototype)) {
        const handler = (prototype as Record<string, unknown>)[methodName];
        for (const role of this.rolesOf(handler)) add(role, source);
      }
    }
    return byRole;
  }

  /** Upsert de los roles base + los declarados. Idempotente. */
  async seed(): Promise<string[]> {
    const declared = this.collectDeclaredRoles();
    const rows = new Map<string, string>();
    for (const base of BASE_ROLES) rows.set(base.name, base.description);
    for (const [name, sources] of declared) {
      if (rows.has(name)) continue;
      rows.set(name, `Sembrado automáticamente desde @Roles() en ${sources.sort().join(', ')}`);
    }

    for (const [name, description] of rows) {
      await this.prisma.role.upsert({
        where: { name },
        update: {}, // nunca pisar una descripción existente
        create: { name, description }
      });
    }
    return [...rows.keys()].sort();
  }

  private rolesOf(target: unknown): string[] {
    if (typeof target !== 'function') return [];
    const roles = Reflect.getMetadata(ROLES_KEY, target) as unknown;
    if (!Array.isArray(roles)) return [];
    return roles.filter((role): role is string => typeof role === 'string' && role.length > 0);
  }
}
