import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  protectedResourceMetadata,
  protectedResourceMetadataPath,
  protectedResourceMetadataUrl
} from './oauth.config';

describe('oauth.config (PRM y discovery)', () => {
  const prev = { ...process.env };
  beforeEach(() => {
    process.env.FACTORY_OAUTH_ISSUER = 'https://staging.apps.awakelab.world/factory-api/oauth';
    process.env.FACTORY_MCP_RESOURCE = 'https://staging.apps.awakelab.world/factory-api/mcp';
  });
  afterEach(() => {
    process.env = { ...prev };
  });

  it('la PRM apunta al recurso MCP y a NUESTRO AS, con offline_access', () => {
    expect(protectedResourceMetadata()).toEqual({
      resource: 'https://staging.apps.awakelab.world/factory-api/mcp',
      authorization_servers: ['https://staging.apps.awakelab.world/factory-api/oauth'],
      scopes_supported: ['offline_access'],
      bearer_methods_supported: ['header']
    });
  });

  it('la URL de la PRM es la forma canónica RFC 9728 (well-known en la raíz, path del recurso a continuación)', () => {
    expect(protectedResourceMetadataUrl()).toBe(
      'https://staging.apps.awakelab.world/.well-known/oauth-protected-resource/factory-api/mcp'
    );
    expect(protectedResourceMetadataPath()).toBe('/.well-known/oauth-protected-resource/factory-api/mcp');
  });

  it('normaliza barras finales del issuer/recurso', () => {
    process.env.FACTORY_MCP_RESOURCE = 'https://staging.apps.awakelab.world/factory-api/mcp/';
    expect(protectedResourceMetadata().resource).toBe('https://staging.apps.awakelab.world/factory-api/mcp');
  });
});
