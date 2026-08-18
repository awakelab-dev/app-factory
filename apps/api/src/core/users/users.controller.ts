import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import {
  CoreUser,
  createUserRequestSchema,
  setUserActiveRequestSchema,
  updateUserRolesRequestSchema,
  type CreateUserRequest,
  type SetUserActiveRequest,
  type UpdateUserRolesRequest
} from '@awk/types';
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
   * Alta de usuario de plataforma (incremento D, bloque 2 — cierre). Sin esto,
   * dar acceso a staging a un gerente del piloto era un `INSERT` a mano: el
   * `dev-login` solo autentica usuarios que ya existen.
   */
  @Post()
  create(
    @Body(new ZodValidationPipe(createUserRequestSchema)) body: CreateUserRequest,
    @CurrentUser() actor: AuthUser
  ): Promise<CoreUser> {
    return this.usersService.create(body, actor?.id);
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
  updateRoles(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserRolesRequestSchema)) body: UpdateUserRolesRequest,
    @CurrentUser() actor: AuthUser
  ): Promise<CoreUser> {
    return this.rolesService.setUserRoles(id, body.roles, actor?.id);
  }

  /** Corta o devuelve el acceso de un usuario (`dev-login` rechaza a los inactivos). */
  @Patch(':id/active')
  setActive(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setUserActiveRequestSchema)) body: SetUserActiveRequest,
    @CurrentUser() actor: AuthUser
  ): Promise<CoreUser> {
    return this.usersService.setActive(id, body.isActive, actor?.id);
  }
}
