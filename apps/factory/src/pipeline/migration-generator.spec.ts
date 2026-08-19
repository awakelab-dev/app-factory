import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GitCommandResult } from './git-client';
import { EXTRA_SQL_FILENAME, generateMigrationForBranch, hasStatements, migrationDirName } from './migration-generator';

const SLUG = 'reserva-salas';
const NOW = new Date('2026-08-18T22:45:00.000Z');
const STAMP = '20260818224500';

const DIFF = [
  '-- CreateSchema',
  'CREATE SCHEMA IF NOT EXISTS "reservas";',
  '',
  '-- CreateTable',
  'CREATE TABLE "reservas"."reservations" (',
  '    "id" UUID NOT NULL,',
  '    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")',
  ');'
].join('\n');

/** Migraciones que ya viven en origin/main en la mayoría de los tests. */
const BASE = ['20260711000000_core_init', '20260713120000_moodle_insights_init'];

let repo = '';

function fakeRepo(localMigrationDirs: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'awkf-migrepo-'));
  mkdirSync(join(dir, 'apps/api/prisma/migrations'), { recursive: true });
  mkdirSync(join(dir, 'apps/api/src/modules', SLUG), { recursive: true });
  writeFileSync(join(dir, 'apps/api/prisma/schema.prisma'), 'datasource db {}\n');
  writeFileSync(join(dir, 'apps/api/prisma/migrations/migration_lock.toml'), 'provider = "postgresql"\n');
  for (const nombre of localMigrationDirs) {
    mkdirSync(join(dir, 'apps/api/prisma/migrations', nombre), { recursive: true });
    writeFileSync(join(dir, 'apps/api/prisma/migrations', nombre, 'migration.sql'), '-- previo\n');
  }
  return dir;
}

/** `git` de mentira que solo entiende los tres comandos que usa el generador. */
function fakeGit(baseDirs: string[] = BASE) {
  return vi.fn(async (args: string[]): Promise<GitCommandResult> => {
    if (args[0] === 'rev-parse') return { stdout: 'abc1234def5678\n', stderr: '' };
    if (args[0] === 'ls-tree') {
      const lineas = [
        ...baseDirs.map((d) => `apps/api/prisma/migrations/${d}/migration.sql`),
        'apps/api/prisma/migrations/migration_lock.toml'
      ];
      return { stdout: `${lineas.join('\n')}\n`, stderr: '' };
    }
    if (args[0] === 'show') return { stdout: 'datasource db {}\n// base\n', stderr: '' };
    throw new Error(`git ${args.join(' ')} no esperado en este test`);
  });
}

const fakePrisma = (stdout: string) => vi.fn(async (): Promise<GitCommandResult> => ({ stdout, stderr: '' }));

const leerSql = (dirName: string) =>
  readFileSync(join(repo, 'apps/api/prisma/migrations', dirName, 'migration.sql'), 'utf8');

describe('generateMigrationForBranch (incremento D, bloque 3a)', () => {
  beforeEach(() => {
    repo = fakeRepo();
  });

  it('escribe el diff en <timestamp>_<slug>/migration.sql y devuelve la base usada', async () => {
    const runGit = fakeGit();
    const runPrisma = fakePrisma(DIFF);

    const result = await generateMigrationForBranch({ repoPath: repo, moduleSlug: SLUG, now: NOW }, { runGit, runPrisma });

    expect(result).toMatchObject({
      dirName: `${STAMP}_reserva_salas`,
      includesExtraSql: false,
      removedDirs: [],
      baseSha: 'abc1234def5678'
    });
    expect(leerSql(`${STAMP}_reserva_salas`)).toBe(`${DIFF}\n`);
  });

  it('compara datamodel contra datamodel (sin shadow DB) y corre el CLI desde apps/api', async () => {
    // Es el corazón del diseño: --from-migrations exigiría una BD viva y el
    // runner no tiene ruta a la managed PostgreSQL (es privada).
    const runGit = fakeGit();
    const runPrisma = fakePrisma(DIFF);

    await generateMigrationForBranch({ repoPath: repo, moduleSlug: SLUG, now: NOW }, { runGit, runPrisma });

    const [args, repoArg] = runPrisma.mock.calls[0] as unknown as [string[], string];
    expect(args.slice(0, 2)).toEqual(['migrate', 'diff']);
    expect(args).toContain('--script');
    expect(args).not.toContain('--from-migrations');
    expect(args[args.indexOf('--to-schema-datamodel') + 1]).toBe(join(repo, 'apps/api/prisma/schema.prisma'));
    // El "antes" sale de origin/main a un temporal, no del disco de la rama.
    const fromPath = args[args.indexOf('--from-schema-datamodel') + 1] as string;
    expect(fromPath.startsWith(repo)).toBe(false);
    expect(runGit).toHaveBeenCalledWith(['show', 'origin/main:apps/api/prisma/schema.prisma'], repo);
    // El cwd correcto (apps/api, donde vive prisma.config.ts) lo resuelve
    // runPrisma a partir del repoPath: no es decisión de quien llama.
    expect(repoArg).toBe(repo);
  });

  it('borra el temporal del schema base al terminar (no deja basura en /tmp)', async () => {
    const runGit = fakeGit();
    let fromPath = '';
    const runPrisma = vi.fn(async (args: string[]): Promise<GitCommandResult> => {
      fromPath = args[args.indexOf('--from-schema-datamodel') + 1] as string;
      expect(existsSync(fromPath)).toBe(true);
      return { stdout: DIFF, stderr: '' };
    });

    await generateMigrationForBranch({ repoPath: repo, moduleSlug: SLUG, now: NOW }, { runGit, runPrisma });

    expect(existsSync(fromPath)).toBe(false);
  });

  it('anexa migration.extra.sql AL FINAL, con comentario de procedencia (D-049)', async () => {
    const extra = 'CREATE UNIQUE INDEX "una_activa" ON "reservas"."reservations" ("roomId") WHERE "status" = \'active\';';
    writeFileSync(join(repo, 'apps/api/src/modules', SLUG, EXTRA_SQL_FILENAME), `${extra}\n`);
    const runPrisma = fakePrisma(DIFF);

    const result = await generateMigrationForBranch(
      { repoPath: repo, moduleSlug: SLUG, now: NOW },
      { runGit: fakeGit(), runPrisma }
    );

    expect(result?.includesExtraSql).toBe(true);
    const sql = leerSql(`${STAMP}_reserva_salas`);
    expect(sql.indexOf(extra)).toBeGreaterThan(sql.indexOf('CREATE TABLE'));
    expect(sql).toContain(`apps/api/src/modules/${SLUG}/${EXTRA_SQL_FILENAME}`);
    expect(sql).toContain('D-049');
  });

  it('si el esquema no cambió y no hay extra, no escribe nada y devuelve null', async () => {
    const runPrisma = fakePrisma('-- This is an empty migration.\n');

    const result = await generateMigrationForBranch(
      { repoPath: repo, moduleSlug: SLUG, now: NOW },
      { runGit: fakeGit(), runPrisma }
    );

    expect(result).toBeNull();
    expect(existsSync(join(repo, 'apps/api/prisma/migrations', `${STAMP}_reserva_salas`))).toBe(false);
  });

  it('si el esquema no cambió pero hay extra, la migración se crea igual (solo con el extra)', async () => {
    writeFileSync(join(repo, 'apps/api/src/modules', SLUG, EXTRA_SQL_FILENAME), 'ALTER TABLE "x" ADD CONSTRAINT "c" CHECK (1=1);\n');
    const runPrisma = fakePrisma('-- This is an empty migration.\n');

    const result = await generateMigrationForBranch(
      { repoPath: repo, moduleSlug: SLUG, now: NOW },
      { runGit: fakeGit(), runPrisma }
    );

    expect(result?.includesExtraSql).toBe(true);
    expect(leerSql(`${STAMP}_reserva_salas`)).toContain('CHECK (1=1)');
  });

  it('un extra vacío o solo con comentarios no cuenta como SQL', async () => {
    writeFileSync(join(repo, 'apps/api/src/modules', SLUG, EXTRA_SQL_FILENAME), '-- nada por ahora\n\n');
    const runPrisma = fakePrisma('-- This is an empty migration.\n');

    const result = await generateMigrationForBranch(
      { repoPath: repo, moduleSlug: SLUG, now: NOW },
      { runGit: fakeGit(), runPrisma }
    );

    expect(result).toBeNull();
  });

  it('filtra el aviso de Prisma 7 para que no acabe dentro del migration.sql', async () => {
    // "Loaded Prisma config from prisma.config.ts." dentro del .sql rompería
    // `prisma migrate deploy` con un error de sintaxis en el primer despliegue.
    const runPrisma = fakePrisma(`Loaded Prisma config from prisma.config.ts.\n\n${DIFF}\n`);

    await generateMigrationForBranch({ repoPath: repo, moduleSlug: SLUG, now: NOW }, { runGit: fakeGit(), runPrisma });

    expect(leerSql(`${STAMP}_reserva_salas`)).toBe(`${DIFF}\n`);
  });

  it('REGENERACIÓN: borra la carpeta que dejó la vuelta anterior de la rama y no toca las de la base', async () => {
    repo = fakeRepo([...BASE, '20260818100000_reserva_salas']);
    const runPrisma = fakePrisma(DIFF);

    const result = await generateMigrationForBranch(
      { repoPath: repo, moduleSlug: SLUG, now: NOW },
      { runGit: fakeGit(), runPrisma }
    );

    expect(result?.removedDirs).toEqual(['20260818100000_reserva_salas']);
    expect(existsSync(join(repo, 'apps/api/prisma/migrations/20260818100000_reserva_salas'))).toBe(false);
    for (const base of BASE) {
      expect(existsSync(join(repo, 'apps/api/prisma/migrations', base))).toBe(true);
    }
    // Una migración por PR: queda exactamente la nueva.
    expect(existsSync(join(repo, 'apps/api/prisma/migrations', `${STAMP}_reserva_salas`))).toBe(true);
  });

  it('un request_change sobre un módulo YA en main nombra la migración _change1', async () => {
    const runPrisma = fakePrisma(DIFF);

    const result = await generateMigrationForBranch(
      { repoPath: repo, moduleSlug: SLUG, now: NOW },
      { runGit: fakeGit([...BASE, '20260816200000_reserva_salas_init']), runPrisma }
    );

    expect(result?.dirName).toBe(`${STAMP}_reserva_salas_change1`);
  });

  it('propaga el fallo del CLI: sin migración no se puede seguir', async () => {
    const runPrisma = vi.fn().mockRejectedValue(new Error('prisma migrate diff falló (código 1): schema inválido'));

    await expect(
      generateMigrationForBranch({ repoPath: repo, moduleSlug: SLUG, now: NOW }, { runGit: fakeGit(), runPrisma })
    ).rejects.toThrow(/schema inválido/);
  });
});

describe('migrationDirName', () => {
  it('sin migraciones previas del módulo, va sin sufijo', () => {
    expect(migrationDirName('focus-flow', new Set(BASE), NOW)).toBe(`${STAMP}_focus_flow`);
  });

  it('cuenta las previas del módulo para el sufijo _change<n>', () => {
    const base = new Set(['20260719150000_focus_flow_init', '20260720100000_focus_flow_change1']);

    expect(migrationDirName('focus-flow', base, NOW)).toBe(`${STAMP}_focus_flow_change2`);
  });

  it('no confunde un slug con otro que lo tiene por prefijo', () => {
    const base = new Set(['20260816200000_reservas_vip_init']);

    expect(migrationDirName('reservas', base, NOW)).toBe(`${STAMP}_reservas`);
  });
});

describe('hasStatements', () => {
  it('distingue SQL real de un archivo con solo comentarios o blancos', () => {
    expect(hasStatements('-- This is an empty migration.')).toBe(false);
    expect(hasStatements('\n\n   \n')).toBe(false);
    expect(hasStatements('-- CreateTable\nCREATE TABLE "a" ();')).toBe(true);
  });
});
