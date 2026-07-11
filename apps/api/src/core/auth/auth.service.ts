import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '@awk/auth';
import { DevLoginResponse } from '@awk/types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService
  ) {}

  /**
   * Login de desarrollo mientras no hay IdP (ver bloqueo en STATUS.md):
   * autentica solo por email contra usuarios sembrados. Deshabilitado por
   * completo en producción. Cuando llegue el IdP, este método se sustituye
   * por el intercambio de tokens SSO y el resto de la plataforma no cambia.
   */
  async devLogin(email: string): Promise<DevLoginResponse> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('dev-login está deshabilitado en producción');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } }
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no registrado o inactivo');
    }

    const roles = user.roles.map((userRole) => userRole.role.name);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.displayName,
      roles
    };
    const accessToken = await this.jwtService.signAsync(payload);

    await this.audit.log({ actorId: user.id, action: 'auth.dev_login' });

    return {
      accessToken,
      user: { id: user.id, email: user.email, displayName: user.displayName, roles }
    };
  }
}
