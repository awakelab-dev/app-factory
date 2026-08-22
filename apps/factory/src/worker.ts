import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { CliModule } from './cli.module';
import { AnalysisWorkerService } from './pipeline/analysis-worker.service';
import { configureGitForGeneration } from './pipeline/git-identity';
import { assertPrismaCli } from './pipeline/prisma-client';
import { assertRunnerEnv } from './pipeline/runner-env';
import { isGenerationKind } from './pipeline/types';
import { parseWorkerKinds } from './pipeline/worker-kinds';

/**
 * Proceso worker de la Fábrica (D-047, incremento C; ampliado en D3).
 *
 *   pnpm --filter=@awk/factory run worker     # local, contra el .env del paquete
 *   node dist/worker.js                       # contenedores factory-runner / factory-generator
 *
 * Consume `analysis_jobs`. Qué kinds sirve lo dice `FACTORY_WORKER_KINDS`, y de
 * ahí salen los dos contenedores del compose sobre la MISMA imagen:
 *
 *   factory-runner     analysis,change_analysis   checkout efímero, deploy key RO
 *   factory-generator  generation,pr_merge        checkout con node_modules, PAT con push
 *
 * Es el único proceso que necesita `PLATFORM_REPO_PATH` y `ANTHROPIC_API_KEY` —
 * el contenedor `factory` que sirve el HTTP/OAuth sigue sin verlos.
 *
 * Usa `CliModule` (sin HTTP, sin JWT, sin Authorization Server): el worker no
 * escucha en ningún puerto, solo habla con la BD y con la API de Anthropic.
 *
 * Arranca comprobando el entorno y sale con código 1 si falta algo: más vale
 * que el contenedor no levante y lo grite en los logs, a que se coma los
 * trabajos de la cola marcándolos en error de uno en uno. Para el worker de
 * generación esa comprobación incluye el CLI de Prisma y la credencial de git,
 * porque descubrir que faltan al final de un run cuesta ~8 USD y 25 minutos.
 */
async function bootstrap(): Promise<void> {
  try {
    const { repoPath } = assertRunnerEnv();
    const kinds = parseWorkerKinds(process.env.FACTORY_WORKER_KINDS);
    const generating = kinds.some(isGenerationKind);

    if (generating) {
      // Mismo criterio que D-047/D-051: todo lo que el run va a necesitar se
      // valida ANTES, no a mitad.
      assertPrismaCli(repoPath);
      await configureGitForGeneration(repoPath);
    }

    console.log(`awk-factory worker: entorno OK (checkout ${repoPath}, kinds [${kinds.join(', ')}]).`);
  } catch (error) {
    console.error(`awk-factory worker: NO arranca — ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn', 'log'] });
  const worker = app.get(AnalysisWorkerService);

  // Parada ordenada: deja de tomar trabajos nuevos. Un trabajo EN CURSO no se
  // interrumpe aquí (el Agent SDK no es cancelable a mitad de forma limpia);
  // si el contenedor lo mata igualmente, el barrido de la vuelta siguiente lo
  // detecta por el latido y sanea run + proyecto.
  const stop = (signal: string) => {
    console.log(`awk-factory worker: ${signal} recibido, no se tomarán más trabajos.`);
    worker.stop();
  };
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('SIGINT', () => stop('SIGINT'));

  try {
    await worker.loop();
  } finally {
    await app.close();
  }
}

void bootstrap();
