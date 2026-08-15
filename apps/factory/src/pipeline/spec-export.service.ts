import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Vuelca las specs de un proyecto desde la BD a `docs/pipeline/<slug>/` de un
 * checkout local (`export-spec` del CLI).
 *
 * Existe por una consecuencia de D-047: con el análisis corriendo en el
 * servidor y su checkout efímero (`reset --hard` antes de cada run), los
 * markdown de spec ya no llegan al repo por sí solos como pasaba cuando el
 * análisis corría en el Mac. La fuente canónica es —y ya era— la tabla `specs`:
 * es lo que leen `/factory`, el conector y el runner de generación. Esto es el
 * puente para conservar el rastro en git cuando interese, sin darle al runner
 * credenciales de escritura sobre el repositorio.
 *
 * Rutas idénticas a las que escribe el agente, para que el diff sea el
 * esperado: la spec de intake en `docs/pipeline/<slug>/`, y cada mini-spec de
 * cambio en `docs/pipeline/<slug>/change-<version>/`.
 */
@Injectable()
export class SpecExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportToRepo(projectId: string, repoPath?: string): Promise<string[]> {
    if (!repoPath) {
      throw new Error(
        'No sé dónde escribir: pasa --out <ruta-al-checkout> o define PLATFORM_REPO_PATH.'
      );
    }
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { specs: { orderBy: { version: 'asc' } } }
    });

    const written: string[] = [];
    for (const spec of project.specs) {
      const dir = spec.changeRequestId
        ? join(repoPath, 'docs/pipeline', project.moduleSlug, `change-${spec.version}`)
        : join(repoPath, 'docs/pipeline', project.moduleSlug);
      await mkdir(dir, { recursive: true });

      const files: Array<[string, string]> = [
        ['spec-funcional.md', spec.functionalContent],
        ['spec-tecnica.md', spec.technicalContent],
        [
          'meta.json',
          `${JSON.stringify(
            {
              complexityScore: spec.complexityScore,
              sensitivityFlags: spec.sensitivityFlags,
              reuseNotes: spec.reuseNotes
            },
            null,
            2
          )}\n`
        ]
      ];
      for (const [name, content] of files) {
        const path = join(dir, name);
        await writeFile(path, content, 'utf-8');
        written.push(path);
      }
    }
    return written;
  }
}
