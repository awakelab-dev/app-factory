import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { CliModule } from './cli.module';
import { AnalysisWorkerService } from './pipeline/analysis-worker.service';
import { assertRunnerEnv } from './pipeline/runner-env';

/**
 * Proceso worker de la Fábrica (D-047, incremento C de Fase 2).
 *
 *   pnpm --filter=@awk/factory run worker     # local, contra el .env del paquete
 *   node dist/worker.js                       # contenedor `factory-runner`
 *
 * Consume `analysis_jobs`: los trabajos que encolan `submit_prototype` y
 * `request_change` desde Cowork. Es el único proceso que necesita
 * `PLATFORM_REPO_PATH` (checkout del monorepo) y `ANTHROPIC_API_KEY` — el
 * contenedor `factory` que sirve el HTTP/OAuth sigue sin verlos.
 *
 * Usa `CliModule` (sin HTTP, sin JWT, sin Authorization Server): el worker no
 * escucha en ningún puerto, solo habla con la BD y con la API de Anthropic.
 *
 * Arranca comprobando el entorno y sale con código 1 si falta algo: más vale
 * que el contenedor no levante y lo grite en los logs, a que se coma los
 * trabajos de la cola marcándolos en error de uno en uno.
 */
async function bootstrap(): Promise<void> {
  try {
    const { repoPath } = assertRunnerEnv();
    console.log(`awk-factory worker: entorno OK (checkout ${repoPath}).`);
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
