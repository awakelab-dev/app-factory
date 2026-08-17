import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { RolesController } from './roles.controller';
import { RolesSeedService } from './roles-seed.service';
import { RolesService } from './roles.service';

/**
 * Roles del core (incremento D, bloque 2): siembra automática al arrancar
 * (`RolesSeedService`, desde los `@Roles()` de los controllers registrados) y
 * asignación a usuarios (`RolesService`, usado también por UsersController).
 *
 * `DiscoveryModule` es lo que da acceso a los controllers registrados para el
 * escaneo — incluidos los de los módulos de negocio descubiertos por
 * `modules/modules.loader.ts`.
 */
@Module({
  imports: [DiscoveryModule],
  controllers: [RolesController],
  providers: [RolesService, RolesSeedService],
  exports: [RolesService]
})
export class RolesModule {}
