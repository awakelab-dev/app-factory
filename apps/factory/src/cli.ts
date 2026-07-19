import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { CliModule } from './cli.module';
import { AnalysisRunnerService } from './pipeline/analysis-runner.service';
import { ChangeRequestsService } from './pipeline/change-requests.service';
import { GatesService } from './pipeline/gates.service';
import { GenerationRunnerService } from './pipeline/generation-runner.service';
import { ProjectsService } from './pipeline/projects.service';
import type { GateDecision, ProjectStatus } from './pipeline/types';

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
          `Comando desconocido: "${command ?? ''}". Comandos: create-project, analyze, decide-gate, generate, request-change, amend-gate, advance, status (ver el comentario al inicio de src/cli.ts).`
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
