import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthUser, JwtPayload, canAccess, payloadToUser } from '@awk/auth';
import { ActorsService } from '../pipeline/actors.service';
import { OauthVerifierService } from '../oauth/oauth-verifier.service';
import { protectedResourceMetadataUrl } from '../oauth/oauth.config';
import type { FactoryActorContext } from '../pipeline/types';
import { FACTORY_ADMIN_ROLES, IS_PUBLIC_KEY } from './auth.constants';

/**
 * Guard global del control plane. Acepta TRES credenciales en el header Bearer:
 *
 * - **JWT de plataforma** (emitido por apps/api, HS256 con JWT_SECRET — D-030):
 *   exige rol `admin`. Es como entra Leonardo por /factory.
 * - **PAT de la Fábrica** (prefijo `awkf_`, tabla factory_actors — D-036): lookup
 *   por hash SHA-256, rechazado si está revocado. Es como entran los técnicos
 *   por Claude Code CLI.
 * - **JWT del Authorization Server propio** (ES256, docs/08/D-041): lo emite
 *   NUESTRO AS tras el login usuario/contraseña del gerente en el flujo OAuth
 *   del conector de Cowork. Se valida firma+iss+aud+exp (OauthVerifierService) y
 *   el email (`sub`) se mapea a una fila ACTIVA de factory_actors.
 *
 * Las tres dejan en `request.actor` un FactoryActorContext {email, rol}; la
 * autorización FINA (scope por proyecto, gates por rol) vive en los servicios.
 * El tipo se decide primero: prefijo `awkf_` → PAT; si no, por el `alg` de la
 * cabecera JWT (ES* → AS propio; el resto → plataforma). La verificación
 * criptográfica es el gate real, no el enrutado.
 */
@Injectable()
export class FactoryAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly actors: ActorsService,
    private readonly oauthVerifier: OauthVerifierService
  ) {}

  /** Lee el `alg` de la cabecera de un JWT sin verificar (solo para enrutar). */
  private static jwtAlg(token: string): string | undefined {
    const [header] = token.split('.');
    if (!header) return undefined;
    try {
      const json = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as { alg?: string };
      return json.alg;
    } catch {
      return undefined;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      url?: string;
      originalUrl?: string;
      user?: AuthUser;
      actor?: FactoryActorContext;
    }>();
    const response = context.switchToHttp().getResponse<{
      setHeader(name: string, value: string): void;
    }>();

    // Solo el endpoint MCP (Resource Server, spec MCP) debe emitir el 401 con
    // WWW-Authenticate hacia la PRM. Los endpoints admin de /factory no.
    const path = request.originalUrl ?? request.url ?? '';
    const isMcp = /\/factory-api\/mcp(\/|$|\?)/.test(path) || path.endsWith('/factory-api/mcp');
    const deny401 = (message: string): never => {
      if (isMcp) {
        response.setHeader(
          'WWW-Authenticate',
          `Bearer resource_metadata="${protectedResourceMetadataUrl()}"`
        );
      }
      throw new UnauthorizedException(message);
    };

    const header = request.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    // `return deny401(...)` (deny401 devuelve never) para que TS estreche `token`
    // a string en el resto del método.
    if (!token) return deny401('Falta el token Bearer');

    if (ActorsService.isPat(token)) {
      const actor = await this.actors.findActiveByToken(token);
      // Mismo 401 para "no existe" y "revocado": no filtrar cuál.
      if (!actor) return deny401('PAT inválido o revocado');
      request.actor = actor;
      return true;
    }

    // JWT del AS propio (conector Cowork): firma ES256 con NUESTRA JWKS.
    if (FactoryAuthGuard.jwtAlg(token)?.startsWith('ES')) {
      const verified = await this.oauthVerifier.verify(token);
      if (!verified) return deny401('Token del conector inválido o expirado');
      const actor = await this.actors.findActiveByEmail(verified.email);
      // Token bien firmado pero email sin fila activa → 403 (runbook §2.c paso 9).
      if (!actor) throw new ForbiddenException('Tu usuario no está autorizado en la Fábrica');
      request.actor = actor;
      return true;
    }

    let user: AuthUser;
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      user = payloadToUser(payload);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    if (!canAccess(user, FACTORY_ADMIN_ROLES)) {
      throw new ForbiddenException('El control plane de la Fábrica requiere rol admin');
    }

    request.user = user;
    request.actor = { email: user.email, role: 'admin' };
    return true;
  }
}
