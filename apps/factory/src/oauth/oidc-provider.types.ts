import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Superficie MÍNIMA de node-oidc-provider que usa el resto del código. La
 * librería es ESM-only y se carga por `importEsm` (esm-loader.ts): tiparla
 * a mano aquí evita depender de `@types/oidc-provider` (que puede ir por
 * detrás de v9) y acota lo que consumimos.
 */

export interface OidcInteractionPrompt {
  name: string; // 'login' | 'consent' | ...
  reasons?: string[];
  details?: Record<string, unknown>;
}

export interface OidcInteractionDetails {
  uid: string;
  prompt: OidcInteractionPrompt;
  params: Record<string, string | undefined> & { client_id?: string; scope?: string };
  session?: { accountId?: string };
  grantId?: string;
}

export interface OidcGrant {
  addOIDCScope(scope: string): void;
  addResourceScope(resource: string, scope: string): void;
  save(): Promise<string>;
}

export interface OidcGrantCtor {
  new (props: { accountId: string; clientId: string }): OidcGrant;
  find(grantId: string): Promise<OidcGrant | undefined>;
}

export interface OidcProviderLike {
  proxy: boolean;
  callback(): (req: IncomingMessage, res: ServerResponse) => void;
  interactionDetails(req: IncomingMessage, res: ServerResponse): Promise<OidcInteractionDetails>;
  interactionFinished(
    req: IncomingMessage,
    res: ServerResponse,
    result: Record<string, unknown>
  ): Promise<void>;
  interactionResult(
    req: IncomingMessage,
    res: ServerResponse,
    result: Record<string, unknown>
  ): Promise<string>;
  Grant: OidcGrantCtor;
}

/** Token de inyección Nest para el provider construido asíncronamente. */
export const OIDC_PROVIDER = Symbol('OIDC_PROVIDER');
