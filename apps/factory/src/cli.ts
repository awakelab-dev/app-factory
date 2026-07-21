import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import * as readline from 'node:readline';
import { Writable } from 'node:stream';
import { NestFactory } from '@nestjs/core';
import { CliModule } from './cli.module';
import { importEsm } from './oauth/esm-loader';
import { ActorsService } from './pipeline/actors.service';
import { AnalysisRunnerService } from './pipeline/analysis-runner.service';
import { ChangeRequestsService } from './pipeline/change-requests.service';
import { GatesService } from './pipeline/gates.service';
import { GenerationRunnerService } from './pipeline/generation-runner.service';
import { ProjectsService } from './pipeline/projects.service';
import type { FactoryActorRole, GateDecision, ProjectStatus } from './pipeline/types';

/**
 * CLI de la Fábrica. Fase 1 (docs/06-roadmap.md: "lanzado por un dev", sin
 * cola de trabajos ni dashboard todavía — eso es el paso 2 de D-026). Uso:
 *
 *   pnpm --filter=@awk/factory run cli -- create-project \
 *     --slug orientador-ia --name "Orientador IA" \
 *     --requested-by leonardo.barreto@awakelab.dev --source-ref "/ruta/al/prototipo"
 *
 *   pnpm --filter=@awk/factory run cli -- analyze <projectId>
 *   pnpm --filter=@awk/factory run cli -- decide-gate <gateId> approved --reviewer x@y.com --notes "..."
 *   pnpm --filter=@awk/factory run cli -- generate <specId>
 *   pnpm --filter=@awk/factory run cli -- advance <projectId> <nuevoEstado>
 *   pnpm --filter=@awk/factory run cli -- status <projectId>
 *
 *   # request_change (docs/04) sobre un módulo YA vivo:
 *   pnpm --filter=@awk/factory run cli -- request-change <projectId> \
 *     --request "Restringir 'Desempeño por persona' a admin" --requested-by x@y.com
 *   # enmendar la nota de un gate ya decidido sin re-decidirlo (D-033):
 *   pnpm --filter=@awk/factory run cli -- amend-gate <gateId> --notes "..." --reviewer x@y.com
 *
 *   # PATs de actores de la Fábrica (D-036, auth interina para el conector MCP):
 *   pnpm --filter=@awk/factory run cli -- create-actor --email gerente@awakelab.dev --role gerente
 *   #   (imprime el token UNA vez; reemitir revoca los anteriores del mismo email)
 *   pnpm --filter=@awk/factory run cli -- revoke-actor --email gerente@awakelab.dev
 *
 *   # Login OAuth del conector Cowork (docs/08, D-041):
 *   pnpm --filter=@awk/factory run cli -- set-password --email gerente@awakelab.dev
 *   #   (prompt oculto; guarda solo el hash argon2id. El actor debe existir)
 *   pnpm --filter=@awk/factory run cli -- oauth-genkeys
 *   #   (genera JWKS ES256 + cookie keys + client secret para el .env de factory)
 *
 * Requiere FACTORY_DATABASE_URL, ANTHROPIC_API_KEY y PLATFORM_REPO_PATH
 * (analyze/generate) — ver .env.example.
 */

const GATE_DECISIONS = ['approved', 'rejected', 'changes_requested'] as const;

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg?.startsWith('--')) {
      flags[arg.slice(2)] = args[i + 1] ?? '';
      i += 1;
    }
  }
  return flags;
}

function requiredFlag(flags: Record<string, string>, key: string): string {
  const value = flags[key];
  if (!value) {
    throw new Error(`Falta el flag --${key}`);
  }
  return value;
}

function requiredArg(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Falta el argumento posicional <${name}>`);
  }
  return value;
}

/** Lee una contraseña por stdin sin mostrarla (eco silenciado). */
function promptHidden(query: string): Promise<string> {
  return new Promise((resolve) => {
    let muted = false;
    const mutedOut = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) process.stdout.write(chunk, encoding as BufferEncoding);
        callback();
      }
    });
    const rl = readline.createInterface({ input: process.stdin, output: mutedOut, terminal: true });
    rl.question(query, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

function parseGateDecision(value: string | undefined): GateDecision {
  const decision = requiredArg(value, 'decision');
  if (!(GATE_DECISIONS as readonly string[]).includes(decision)) {
    throw new Error(`decision inválida: "${decision}" (valores: ${GATE_DECISIONS.join(', ')})`);
  }
  return decision as GateDecision;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  // pnpm reenvía el separador "--" LITERAL al script (pnpm run cli -- create-project
  // llega como ["--", "create-project", ...]) — se descarta si viene primero.
  if (argv[0] === '--') argv.shift();
  const [command, ...rest] = argv;
  const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn', 'log'] });

  try {
    switch (command) {
      case 'create-project': {
        const flags = parseFlags(rest);
        const project = await app.get(ProjectsService).create({
          moduleSlug: requiredFlag(flags, 'slug'),
          displayName: requiredFlag(flags, 'name'),
          requestedBy: requiredFlag(flags, 'requested-by'),
          sourceRef: requiredFlag(flags, 'source-ref')
        });
        console.log(JSON.stringify(project, null, 2));
        break;
      }

      case 'analyze': {
        const projectId = requiredArg(rest[0], 'projectId');
        const spec = await app.get(AnalysisRunnerService).runAnalysis(projectId);
        console.log(JSON.stringify(spec, null, 2));
        break;
      }

      case 'decide-gate': {
        const gateId = requiredArg(rest[0], 'gateId');
        const decision = parseGateDecision(rest[1]);
        const flags = parseFlags(rest.slice(2));
        const gate = await app.get(GatesService).decide({
          gateId,
          decision,
          reviewer: flags.reviewer ?? 'leonardo.barreto@awakelab.dev',
          notes: flags.notes
        });
        console.log(JSON.stringify(gate, null, 2));
        break;
      }

      case 'generate': {
        const specId = requiredArg(rest[0], 'specId');
        const run = await app.get(GenerationRunnerService).runGeneration(specId);
        console.log(JSON.stringify(run, null, 2));
        break;
      }

      case 'request-change': {
        const projectId = requiredArg(rest[0], 'projectId');
        const flags = parseFlags(rest.slice(1));
        const changeRequest = await app.get(ChangeRequestsService).create({
          projectId,
          requestedBy: flags['requested-by'] ?? 'leonardo.barreto@awakelab.dev',
          requestText: requiredFlag(flags, 'request')
        });
        const spec = await app.get(AnalysisRunnerService).runChangeAnalysis(changeRequest.id);
        console.log(JSON.stringify({ changeRequest, spec }, null, 2));
        break;
      }

      case 'create-actor': {
        const flags = parseFlags(rest);
        const role = requiredFlag(flags, 'role');
        if (role !== 'gerente' && role !== 'admin') {
          throw new Error(`--role inválido: "${role}" (valores: gerente, admin)`);
        }
        const created = await app.get(ActorsService).createActor({
          email: requiredFlag(flags, 'email'),
          role: role as FactoryActorRole
        });
        // El token se imprime UNA sola vez — en BD solo queda su hash.
        console.log(JSON.stringify({ id: created.id, email: created.email, role: created.role }, null, 2));
        console.log(`\nPAT (guárdalo ahora, no se puede recuperar):\n${created.token}`);
        break;
      }

      case 'revoke-actor': {
        const flags = parseFlags(rest);
        const email = requiredFlag(flags, 'email');
        const revoked = await app.get(ActorsService).revokeActor(email);
        console.log(
          revoked > 0
            ? `Revocados ${revoked} token(s) activo(s) de ${email}.`
            : `${email} no tenía tokens activos — nada que revocar.`
        );
        break;
      }

      case 'set-password': {
        const flags = parseFlags(rest);
        const email = requiredFlag(flags, 'email');
        const password = flags.password ?? (await promptHidden('Contraseña (mín. 12 caracteres): '));
        const confirm = flags.password ?? (await promptHidden('Repite la contraseña: '));
        if (password !== confirm) {
          throw new Error('Las contraseñas no coinciden.');
        }
        await app.get(ActorsService).setPassword(email, password);
        console.log(`Contraseña de login del AS seteada para ${email} (solo se guardó el hash argon2id).`);
        break;
      }

      case 'oauth-genkeys': {
        const { generateKeyPair, exportJWK, calculateJwkThumbprint } = await importEsm<{
          generateKeyPair: (alg: string, opts?: { extractable?: boolean }) => Promise<{ privateKey: unknown }>;
          exportJWK: (key: unknown) => Promise<Record<string, unknown>>;
          calculateJwkThumbprint: (jwk: Record<string, unknown>) => Promise<string>;
        }>('jose');
        const { privateKey } = await generateKeyPair('ES256', { extractable: true });
        const jwk = await exportJWK(privateKey);
        jwk.alg = 'ES256';
        jwk.use = 'sig';
        jwk.kid = await calculateJwkThumbprint(jwk);
        console.log('# Secretos del Authorization Server — pégalos en /opt/awkfactory/<entorno>/.env');
        console.log('# (una vez; NO los commitees; SIN COMILLAS — misma regla que el resto del .env).');
        console.log('# Ver docs/runbooks/oauth-conector-as-propio.md.\n');
        console.log(`FACTORY_OAUTH_JWKS=${JSON.stringify({ keys: [jwk] })}`);
        console.log(`FACTORY_OAUTH_COOKIE_KEYS=${randomBytes(32).toString('hex')},${randomBytes(32).toString('hex')}`);
        console.log(`FACTORY_OAUTH_CLIENT_SECRET=${randomBytes(32).toString('hex')}`);
        break;
      }

      case 'amend-gate': {
        const gateId = requiredArg(rest[0], 'gateId');
        const flags = parseFlags(rest.slice(1));
        const gate = await app.get(GatesService).amendNotes({
          gateId,
          reviewer: flags.reviewer ?? 'leonardo.barreto@awakelab.dev',
          notes: requiredFlag(flags, 'notes')
        });
        console.log(JSON.stringify(gate, null, 2));
        break;
      }

      case 'advance': {
        const projectId = requiredArg(rest[0], 'projectId');
        const newStatus = requiredArg(rest[1], 'nuevoEstado') as ProjectStatus;
        const project = await app.get(ProjectsService).transition(projectId, newStatus);
        console.log(JSON.stringify(project, null, 2));
        break;
      }

      case 'status': {
        const projectId = requiredArg(rest[0], 'projectId');
        const project = await app.get(ProjectsService).getFullStatus(projectId);
        console.log(JSON.stringify(project, null, 2));
        break;
      }

      default:
        console.error(
          `Comando desconocido: "${command ?? ''}". Comandos: create-project, analyze, decide-gate, generate, request-change, amend-gate, create-actor, revoke-actor, set-password, oauth-genkeys, advance, status (ver el comentario al inicio de src/cli.ts).`
        );
        process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
