import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGit } from './git-client';
import { runPrisma } from './prisma-client';

const SCHEMA_REL = 'apps/api/prisma/schema.prisma';
const MIGRATIONS_REL = 'apps/api/prisma/migrations';

/** Nombre del archivo con el SQL que Prisma no sabe declarar (D-049). */
export const EXTRA_SQL_FILENAME = 'migration.extra.sql';

export interface MigrationGeneratorDeps {
  runGit?: typeof runGit;
  runPrisma?: typeof runPrisma;
}

export interface GenerateMigrationOptions {
  /** Checkout del monorepo sobre el que trabajó el agente. */
  repoPath: string;
  moduleSlug: string;
  /** Base del diff. Es la base de la rama `factory/<slug>`. */
  baseRef?: string;
  /** Inyectable solo para los tests (nombres de carpeta deterministas). */
  now?: Date;
}

export interface GeneratedMigration {
  /** Carpeta creada bajo apps/api/prisma/migrations/, p. ej. `20260818224500_reserva_salas`. */
  dirName: string;
  /** Contenido final del migration.sql (diff + extra, si había extra). */
  sql: string;
  /** true si se anexó apps/api/src/modules/<slug>/migration.extra.sql. */
  includesExtraSql: boolean;
  /** Carpetas de migración que esta rama había añadido y se reescribieron. */
  removedDirs: string[];
  /** sha de `baseRef`: sin esto, un diff raro no se puede reproducir después. */
  baseSha: string;
}

/**
 * Genera la migración de un módulo DENTRO del run de generación (incremento D,
 * bloque 3a — docs/09-incremento-d-cero-consola.md).
 *
 * Lo hace código nuestro, no el agente: `apps/api/prisma/migrations/` está
 * fuera de sus `writableRoots` y así sigue. El agente solo declara el modelo en
 * `schema.prisma` (y, si hace falta, el SQL que Prisma no expresa en su propio
 * `migration.extra.sql`); el `.sql` aplicable lo escribe esta función y entra en
 * la PR, donde se revisa en el gate técnico.
 *
 * **Por qué datamodel → datamodel**: `prisma migrate diff` con
 * `--from-schema-datamodel` / `--to-schema-datamodel` compara dos archivos de
 * esquema y no necesita ni shadow database ni conexión. La alternativa
 * (`--from-migrations`) exige una BD viva, y el runner no tiene ruta a la
 * managed PostgreSQL (es privada, docs/runbooks/lightsail-postgres.md).
 *
 * Devuelve `null` cuando no hay nada que migrar (un módulo puede ser solo de
 * lectura sobre modelos que ya existen, o un cambio puede no tocar el esquema).
 */
export async function generateMigrationForBranch(
  options: GenerateMigrationOptions,
  deps: MigrationGeneratorDeps = {}
): Promise<GeneratedMigration | null> {
  const { repoPath, moduleSlug } = options;
  const baseRef = options.baseRef ?? 'origin/main';
  const now = options.now ?? new Date();
  const git = deps.runGit ?? runGit;
  const prisma = deps.runPrisma ?? runPrisma;

  const migrationsDir = join(repoPath, MIGRATIONS_REL);
  const { stdout: shaOut } = await git(['rev-parse', baseRef], repoPath);
  const baseSha = shaOut.trim();

  const baseDirs = await migrationDirsIn(baseRef, git, repoPath);

  // REGENERACIÓN sobre la misma rama: una migración por PR, sin apilar. Si la
  // vuelta anterior ya dejó una carpeta, se borra y se reescribe — el diff
  // nuevo se calcula contra origin/main, así que ya la contiene entera.
  // Se comparan CARPETAS (no `git diff`) a propósito: si el push de la vuelta
  // anterior falló, esa carpeta está sin commitear y `git diff` no la vería.
  const removedDirs = localMigrationDirs(migrationsDir)
    .filter((dir) => !baseDirs.has(dir))
    .sort();
  for (const dir of removedDirs) {
    rmSync(join(migrationsDir, dir), { recursive: true, force: true });
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'awkf-migdiff-'));
  try {
    const { stdout: baseSchema } = await git(['show', `${baseRef}:${SCHEMA_REL}`], repoPath);
    const basePath = join(tmpDir, 'schema.prisma');
    writeFileSync(basePath, baseSchema, 'utf8');

    const { stdout: rawDiff } = await prisma(
      [
        'migrate',
        'diff',
        '--from-schema-datamodel',
        basePath,
        '--to-schema-datamodel',
        join(repoPath, SCHEMA_REL),
        '--script'
      ],
      repoPath
    );

    const diffSql = stripNonSqlNoise(rawDiff);
    const extraSql = readExtraSql(repoPath, moduleSlug);

    if (!hasStatements(diffSql) && !extraSql) return null;

    const sections: string[] = [];
    if (hasStatements(diffSql)) sections.push(diffSql.trimEnd());
    if (extraSql) sections.push(`${provenanceComment(moduleSlug)}\n${extraSql.trimEnd()}`);
    const sql = `${sections.join('\n\n')}\n`;

    const dirName = migrationDirName(moduleSlug, baseDirs, now);
    mkdirSync(join(migrationsDir, dirName), { recursive: true });
    writeFileSync(join(migrationsDir, dirName, 'migration.sql'), sql, 'utf8');

    return { dirName, sql, includesExtraSql: Boolean(extraSql), removedDirs, baseSha };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/** Carpetas de migración que existen en `ref` (según git, no según el disco). */
async function migrationDirsIn(ref: string, git: typeof runGit, repoPath: string): Promise<Set<string>> {
  const { stdout } = await git(['ls-tree', '-r', '--name-only', ref, '--', MIGRATIONS_REL], repoPath);
  const dirs = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith(`${MIGRATIONS_REL}/`))
    .map((line) => line.slice(MIGRATIONS_REL.length + 1))
    // Solo lo que está DENTRO de una carpeta: `migration_lock.toml` cuelga
    // directamente de migrations/ y no es una migración.
    .filter((rest) => rest.includes('/'))
    .map((rest) => rest.split('/')[0] as string);
  return new Set(dirs);
}

function localMigrationDirs(migrationsDir: string): string[] {
  try {
    return readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    // El módulo puede ser el primero que migra en un checkout recién creado.
    return [];
  }
}

/**
 * `<timestamp>_<slug>` la primera vez y `<timestamp>_<slug>_change<n>` después,
 * contando cuántas migraciones de ESTE módulo ya viven en la base. Sin el
 * sufijo, dos cambios sucesivos del mismo módulo darían nombres que solo se
 * distinguen por el timestamp y `git log` dejaría de contar la historia.
 */
export function migrationDirName(moduleSlug: string, baseDirs: Set<string>, now: Date): string {
  const slug = toSnake(moduleSlug);
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  // El sufijo se compara contra los nombres EXACTOS que este esquema puede
  // producir (o el `_init` que traen las migraciones hechas a mano). Un
  // `startsWith(slug + '_')` no serviría: el guion bajo separa también las
  // palabras del propio slug, así que "reservas" contaría las de
  // "reservas_vip" y numeraría el cambio de otro módulo.
  const propia = new RegExp(`^${slug}(_init|_change\\d+)?$`);
  const mine = [...baseDirs].filter((dir) => propia.test(dir.replace(/^\d+_/, '')));
  return mine.length === 0 ? `${stamp}_${slug}` : `${stamp}_${slug}_change${mine.length}`;
}

function toSnake(moduleSlug: string): string {
  return moduleSlug.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function readExtraSql(repoPath: string, moduleSlug: string): string | null {
  try {
    const contenido = readFileSync(join(repoPath, 'apps/api/src/modules', moduleSlug, EXTRA_SQL_FILENAME), 'utf8');
    return hasStatements(contenido) ? contenido : null;
  } catch {
    return null;
  }
}

function provenanceComment(moduleSlug: string): string {
  return [
    `-- Añadido automáticamente desde apps/api/src/modules/${moduleSlug}/${EXTRA_SQL_FILENAME}`,
    '-- (constraints que Prisma no sabe declarar: índice único parcial, CHECK, exclusion).',
    '-- No editar aquí: se reescribe en cada generación. Ver D-049 y docs/09-incremento-d-cero-consola.md.'
  ].join('\n');
}

/**
 * Quita del stdout de Prisma lo que no es SQL. Prisma 7 anuncia
 * "Loaded Prisma config from prisma.config.ts." antes del script, y ese texto
 * dentro de un `migration.sql` haría que `prisma migrate deploy` fallara con un
 * error de sintaxis en el primer despliegue — exactamente el 500 silencioso que
 * D2 viene a eliminar. Se filtra por líneas y no por prefijo del bloque porque
 * el aviso puede ir acompañado de líneas en blanco.
 */
export function stripNonSqlNoise(stdout: string): string {
  return stdout
    .split('\n')
    .filter((line) => !/^\s*Loaded Prisma config from .*$/.test(line))
    .filter((line) => !/^\s*(Prisma schema loaded from|Environment variables loaded from) /.test(line))
    .join('\n')
    .trim();
}

/**
 * ¿Queda alguna sentencia, o solo comentarios? Con `--script` y sin cambios,
 * Prisma imprime `-- This is an empty migration.`; mirar si sobrevive algo tras
 * quitar comentarios y blancos es más robusto que comparar contra ese texto
 * exacto, que es un detalle de implementación de Prisma.
 */
export function hasStatements(sql: string): boolean {
  return sql
    .split('\n')
    .map((line) => line.trim())
    .some((line) => line.length > 0 && !line.startsWith('--'));
}
