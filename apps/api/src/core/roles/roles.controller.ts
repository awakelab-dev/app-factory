import { Controller, Get } from '@nestjs/common';
import type { CoreRole } from '@awk/types';
import { Roles } from '../auth/auth.decorators';
import { RolesService } from './roles.service';

/**
 * Roles de la plataforma. Solo admin: es la lista con la que
 * `/admin/usuarios` pinta las casillas de asignación (incremento D, bloque 2).
 */
@Controller('core/roles')
@Roles('admin')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  list(): Promise<CoreRole[]> {
    return this.rolesService.list();
  }
}
