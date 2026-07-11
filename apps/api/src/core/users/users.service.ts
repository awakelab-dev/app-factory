import { Injectable } from '@nestjs/common';
import { CoreUser } from '@awk/types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<CoreUser[]> {
    const users = await this.prisma.user.findMany({
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'asc' }
    });
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isActive: user.isActive,
      roles: user.roles.map((userRole) => userRole.role.name),
      createdAt: user.createdAt.toISOString()
    }));
  }
}
