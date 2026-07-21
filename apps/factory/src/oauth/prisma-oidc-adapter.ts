import type { PrismaService } from '../prisma/prisma.service';

/**
 * Adapter de persistencia de node-oidc-provider sobre Prisma (docs/08, D-041,
 * runbook §2.b checklist "adapter Prisma"). La librería instancia
 * `new Adapter(modelName)` una vez por tipo de modelo (Session, Grant,
 * AccessToken, RefreshToken, AuthorizationCode, Interaction, ...) — como no
 * puede inyectar dependencias, exponemos una FÁBRICA que cierra sobre el
 * PrismaService del contenedor Nest y devuelve la clase adapter ligada a él.
 *
 * Contrato (example/my_adapter.js de la librería): upsert/find/findByUserCode/
 * findByUid/consume/destroy/revokeByGrantId. Todo va a la tabla única
 * `oauth_models` (payload JSONB opaco); las columnas auxiliares (grantId,
 * userCode, uid, expiresAt, consumedAt) se desnormalizan del payload para los
 * find-by y el single-use, sin parsear el JSON.
 */

interface OidcPayload {
  grantId?: string;
  userCode?: string;
  uid?: string;
  [key: string]: unknown;
}

export interface OidcAdapter {
  upsert(id: string, payload: OidcPayload, expiresIn: number): Promise<void>;
  find(id: string): Promise<OidcPayload | undefined>;
  findByUserCode(userCode: string): Promise<OidcPayload | undefined>;
  findByUid(uid: string): Promise<OidcPayload | undefined>;
  consume(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  revokeByGrantId(grantId: string): Promise<void>;
}

export type OidcAdapterFactory = new (modelName: string) => OidcAdapter;

/** Marca `consumed` (epoch s) que la librería espera en find() de un modelo consumido. */
function withConsumed(payload: OidcPayload, consumedAt: Date | null): OidcPayload {
  if (!consumedAt) return payload;
  return { ...payload, consumed: Math.floor(consumedAt.getTime() / 1000) };
}

export function createPrismaOidcAdapter(prisma: PrismaService): OidcAdapterFactory {
  return class PrismaOidcAdapter implements OidcAdapter {
    constructor(private readonly model: string) {}

    async upsert(id: string, payload: OidcPayload, expiresIn: number): Promise<void> {
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
      const data = {
        payload: payload as object,
        grantId: payload.grantId ?? null,
        userCode: payload.userCode ?? null,
        uid: payload.uid ?? null,
        expiresAt
      };
      await prisma.oauthModel.upsert({
        where: { model_id: { model: this.model, id } },
        create: { model: this.model, id, ...data },
        update: data
      });
    }

    async find(id: string): Promise<OidcPayload | undefined> {
      const row = await prisma.oauthModel.findUnique({ where: { model_id: { model: this.model, id } } });
      if (!row) return undefined;
      if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return undefined;
      return withConsumed(row.payload as OidcPayload, row.consumedAt);
    }

    async findByUserCode(userCode: string): Promise<OidcPayload | undefined> {
      const row = await prisma.oauthModel.findFirst({ where: { model: this.model, userCode } });
      if (!row) return undefined;
      if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return undefined;
      return withConsumed(row.payload as OidcPayload, row.consumedAt);
    }

    async findByUid(uid: string): Promise<OidcPayload | undefined> {
      const row = await prisma.oauthModel.findFirst({ where: { model: this.model, uid } });
      if (!row) return undefined;
      if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return undefined;
      return withConsumed(row.payload as OidcPayload, row.consumedAt);
    }

    async consume(id: string): Promise<void> {
      await prisma.oauthModel.update({
        where: { model_id: { model: this.model, id } },
        data: { consumedAt: new Date() }
      });
    }

    async destroy(id: string): Promise<void> {
      await prisma.oauthModel.deleteMany({ where: { model: this.model, id } });
    }

    async revokeByGrantId(grantId: string): Promise<void> {
      await prisma.oauthModel.deleteMany({ where: { grantId } });
    }
  };
}
