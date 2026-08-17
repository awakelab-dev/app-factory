import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // RolesModule: `PUT /core/users/:id/roles` delega en RolesService (incremento
  // D, bloque 2) — la asignación vive con los roles, no duplicada aquí.
  imports: [RolesModule],
  controllers: [UsersController],
  providers: [UsersService]
})
export class UsersModule {}
