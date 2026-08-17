import { Body, Controller, Get, Param, Put, UsePipes } from '@nestjs/common';
import { CoreUser, updateUserRolesRequestSchema, type UpdateUserRolesRequest } from '@awk/types';
import type { AuthUser } from '@awk/auth';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { CurrentUser, Roles } from '../auth/auth.decorators';
import { RolesService } from '../roles/roles.service';
import { UsersService } from './users.service';

/** Administración de usuarios del core. Solo admin (primer uso real del RBAC). */
@Controller('core/users')
@Roles('admin')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService
  ) {}

  @Get()
  list(): Promise<CoreUser[]> {
    return this.usersService.list();
  }

  /**
   * Reemplaza los roles de un usuario (incremento D, bloque 2). Hasta
   * 2026-08-17 este controller solo tenía `@Get()`: asignar un rol era SQL a
   * mano — y con él, la única forma de hacer visible un módulo generado que
   * declara roles nuevos (D-049).
   *
   * El cambio se audita (`core.user_roles_changed`) y **no afecta a las sesiones
   * abiertas**: los roles viajan en el JWT y el usuario tiene que volver a
   * entrar. La UI lo dice explícitamente.
   */
  @Put(':id/roles')
  @UsePipes(new ZodValidationPipe(updateUserRolesRequestSchema))
  updateRoles(
    @Param('id') id: string,
    @Body() body: UpdateUserRolesRequest,
    @CurrentUser() actor: AuthUser
  ): Promise<CoreUser> {
    return this.rolesService.setUserRoles(id, body.roles, actor?.id);
  }
}
