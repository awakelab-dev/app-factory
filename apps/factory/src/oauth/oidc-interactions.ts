import { Logger } from '@nestjs/common';
import type { Request, RequestHandler, Response } from 'express';
import type { ActorsService } from '../pipeline/actors.service';
import { OAUTH_MOUNT_PATH } from './oauth.config';
import type { OidcInteractionDetails, OidcProviderLike } from './oidc-provider.types';

/**
 * Manejadores de interacción del Authorization Server (docs/08 §3, runbook §2.b
 * "interacción de login custom"). node-oidc-provider NO trae vistas: cuando la
 * autorización necesita login o consentimiento, redirige a `interactions.url`
 * (aquí, `/factory-api/oauth/interaction/:uid`) y espera que resolvamos el
 * prompt y lo mandemos de vuelta con `interactionFinished`.
 *
 * Se registran como handlers Express crudos (main.ts) ANTES del mount del
 * provider: comparten prefijo `/factory-api/oauth` y el mount del provider es
 * un catch-all que si no, los interceptaría.
 *
 * Dos prompts:
 *  - `login`: renderiza el formulario usuario/contraseña; el POST valida contra
 *    factory_actors + argon2id (ActorsService.verifyCredentials).
 *  - `consent`: cliente `claude` de primera parte pre-registrado → se auto-concede
 *    (sin pantalla de consentimiento), creando/actualizando el Grant con los
 *    scopes/recursos que faltan.
 */

const logger = new Logger('OidcInteractions');

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const LOGO_DARK = 'https://media.awakelab.world/MARCA_AWK26/awakelab_logo_fondo-oscuro_transparente.png';

/** Formulario de login con identidad Awakelab 2026 (Poppins, azules profundos, acento cian). */
function loginPage(uid: string, error?: string): string {
  const action = `${OAUTH_MOUNT_PATH}/interaction/${esc(uid)}/login`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Acceso · AwkFactory</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  :root {
    --azul-01192: #011932; --azul-01264: #01264C; --azul-03260: #003260;
    --cian: #19F7F1; --cian-borde: #0ABCC9; --claro: #F0F3FC; --tenue: #72A3C4;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font-family: 'Poppins', system-ui, sans-serif;
    background: radial-gradient(1200px 600px at 50% -10%, var(--azul-03260), var(--azul-01192) 60%);
    color: var(--claro); padding: 24px;
  }
  .card {
    width: 100%; max-width: 400px; background: rgba(1, 38, 76, 0.72);
    border: 1px solid rgba(25, 247, 241, 0.18); border-radius: 18px;
    padding: 40px 32px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45); backdrop-filter: blur(8px);
  }
  .logo { display: block; height: 40px; margin: 0 auto 28px; }
  h1 { font-size: 20px; font-weight: 600; margin: 0 0 4px; text-align: center; }
  p.sub { margin: 0 0 28px; text-align: center; color: var(--tenue); font-size: 14px; }
  label { display: block; font-size: 13px; font-weight: 500; margin: 0 0 6px; color: var(--claro); }
  input {
    width: 100%; padding: 12px 14px; margin-bottom: 18px; border-radius: 10px;
    border: 1px solid rgba(114, 163, 196, 0.4); background: rgba(1, 25, 50, 0.6);
    color: var(--claro); font-family: inherit; font-size: 15px;
  }
  input:focus { outline: none; border-color: var(--cian); box-shadow: 0 0 0 3px rgba(25, 247, 241, 0.15); }
  button {
    width: 100%; padding: 13px; border: none; border-radius: 10px; cursor: pointer;
    background: var(--cian); color: var(--azul-01192); font-family: inherit;
    font-size: 15px; font-weight: 600; transition: filter 0.15s ease;
  }
  button:hover { filter: brightness(1.08); }
  .error {
    background: rgba(255, 106, 0, 0.12); border: 1px solid rgba(255, 138, 76, 0.5);
    color: #ffd9c2; border-radius: 10px; padding: 10px 12px; font-size: 13px; margin-bottom: 20px;
  }
  .foot { margin-top: 22px; text-align: center; font-size: 12px; color: var(--tenue); }
</style>
</head>
<body>
  <form class="card" method="post" action="${action}" autocomplete="off">
    <img class="logo" src="${LOGO_DARK}" alt="Awakelab" />
    <h1>La Fábrica</h1>
    <p class="sub">Inicia sesión para conectar Cowork</p>
    ${error ? `<div class="error">${esc(error)}</div>` : ''}
    <label for="email">Correo</label>
    <input id="email" name="email" type="email" required autofocus inputmode="email" />
    <label for="password">Contraseña</label>
    <input id="password" name="password" type="password" required />
    <button type="submit">Entrar</button>
    <p class="foot">Acceso exclusivo para gerentes de Awakelab.</p>
  </form>
</body>
</html>`;
}

/** GET /factory-api/oauth/interaction/:uid — renderiza login o auto-concede consentimiento. */
export function renderInteraction(provider: OidcProviderLike): RequestHandler {
  return async (req: Request, res: Response) => {
    try {
      const details = await provider.interactionDetails(req, res);
      const { prompt } = details;
      if (prompt.name === 'login') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.send(loginPage(details.uid));
        return;
      }
      if (prompt.name === 'consent') {
        await autoConsent(provider, req, res, details);
        return;
      }
      res.status(400).send(`Prompt de interacción no soportado: ${esc(prompt.name)}`);
    } catch (error) {
      logger.error(`interactionDetails falló: ${(error as Error).message}`);
      res.status(400).send('Sesión de interacción inválida o expirada. Reinicia el flujo desde Cowork.');
    }
  };
}

/** POST /factory-api/oauth/interaction/:uid/login — valida credenciales. */
export function submitLogin(provider: OidcProviderLike, actors: ActorsService): RequestHandler {
  return async (req: Request, res: Response) => {
    let uid = 'unknown';
    try {
      const details = await provider.interactionDetails(req, res);
      uid = details.uid;
      const body = (req.body ?? {}) as { email?: string; password?: string };
      const email = (body.email ?? '').trim().toLowerCase();
      const password = body.password ?? '';
      const actor = email && password ? await actors.verifyCredentials(email, password) : null;
      if (!actor) {
        // Mensaje genérico: no filtra si el email existe o la contraseña falla.
        res.status(401).setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(loginPage(uid, 'Credenciales incorrectas. Verifica tu correo y contraseña.'));
        return;
      }
      await provider.interactionFinished(req, res, {
        login: { accountId: actor.email, remember: false }
      });
    } catch (error) {
      logger.error(`submitLogin falló (uid=${uid}): ${(error as Error).message}`);
      res.status(400).send('No se pudo completar el inicio de sesión. Reinicia el flujo desde Cowork.');
    }
  };
}

/**
 * Consentimiento automático para el cliente de primera parte `claude`
 * (pre-registrado, de confianza): concede los scopes OIDC y de recurso que
 * falten y finaliza. No hay pantalla de consentimiento (no aporta a un único
 * cliente propio; el gerente ya se autenticó).
 */
async function autoConsent(
  provider: OidcProviderLike,
  req: Request,
  res: Response,
  details: OidcInteractionDetails
): Promise<void> {
  const accountId = details.session?.accountId;
  const clientId = details.params.client_id;
  if (!accountId || !clientId) {
    res.status(400).send('Falta la sesión de usuario para el consentimiento.');
    return;
  }
  const grant = details.grantId
    ? await provider.Grant.find(details.grantId)
    : new provider.Grant({ accountId, clientId });
  if (!grant) {
    res.status(400).send('No se pudo resolver el consentimiento.');
    return;
  }
  const promptDetails = details.prompt.details as {
    missingOIDCScope?: string[];
    missingResourceScopes?: Record<string, string[]>;
  };
  if (promptDetails.missingOIDCScope) {
    grant.addOIDCScope(promptDetails.missingOIDCScope.join(' '));
  }
  if (promptDetails.missingResourceScopes) {
    for (const [indicator, scopes] of Object.entries(promptDetails.missingResourceScopes)) {
      grant.addResourceScope(indicator, scopes.join(' '));
    }
  }
  const grantId = await grant.save();
  await provider.interactionFinished(req, res, { consent: { grantId } });
}
