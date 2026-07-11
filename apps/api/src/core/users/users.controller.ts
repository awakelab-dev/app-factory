import { Controller, Get } from '@nestjs/common';
import { CoreUser } from '@awk/types';
import { Roles } from '../auth/auth.decorators';
import { UsersService } from './users.service';

/** Administración de usuarios del core. Solo admin (primer uso real del RBAC). */
@Controller('core/users')
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(): Promise<CoreUser[]> {
    return this.usersService.list();
  }
}
