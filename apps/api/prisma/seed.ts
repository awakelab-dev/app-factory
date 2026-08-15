/**
 * Seed de desarrollo: roles base + usuarios dev para dev-login.
 * Ejecutar con `pnpm prisma:seed` (o automáticamente tras `prisma migrate dev`).
 * Idempotente (upserts): se puede correr las veces que haga falta.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { INCIDENCIAS_AULA_SEED_AULAS } from '../src/modules/incidencias-aula/incidencias-aula-seed-data';
import { ORIENTADOR_ACADEMIES } from './seed-data/orientador-academies';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://awk:awk@localhost:5432/awkplatform';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main(): Promise<void> {
  const admin = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin', description: 'Administración de la plataforma (core y todos los módulos)' }
  });
  const user = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: { name: 'user', description: 'Usuario estándar de la plataforma' }
  });
  // orientador-ia (D-025): rol acotado al módulo, para el personal de Aspasia
  // que administra leads/academias — no ve el resto de la plataforma salvo
  // que además tenga 'admin' o 'user'.
  await prisma.role.upsert({
    where: { name: 'orientador_admin' },
    update: {},
    create: { name: 'orientador_admin', description: 'Panel admin del módulo orientador-ia (leads, academias)' }
  });
  // incidencias-aula (2026-08-15): tres roles DISJUNTOS sobre la misma
  // entidad — docente (solo sus partes), coordinación (bandeja completa y
  // cierre) y dirección (resumen agregado, sin datos identificativos).
  const incidenciasRoles: Array<{ name: string; description: string }> = [
    { name: 'incidencias_docente', description: 'Incidencias de aula: registra partes y consulta los suyos' },
    { name: 'incidencias_coordinacion', description: 'Incidencias de aula: bandeja completa, seguimiento y cierre' },
    { name: 'incidencias_direccion', description: 'Incidencias de aula: resumen mensual agregado, sin datos identificativos' }
  ];
  for (const role of incidenciasRoles) {
    await prisma.role.upsert({ where: { name: role.name }, update: {}, create: role });
  }

  const users: Array<{ email: string; displayName: string; roleId: string }> = [
    { email: 'leonardo.barreto@awakelab.dev', displayName: 'Leonardo Barreto', roleId: admin.id },
    { email: 'demo@awakelab.dev', displayName: 'Usuaria Demo', roleId: user.id }
  ];

  for (const u of users) {
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, displayName: u.displayName }
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: created.id, roleId: u.roleId } },
      update: {},
      create: { userId: created.id, roleId: u.roleId }
    });
  }

  // orientador-ia (D-025): contenido real de las 13 academias, copiado
  // literalmente del prototipo original — idempotente (upsert por id).
  for (const academy of ORIENTADOR_ACADEMIES) {
    await prisma.orientadorAcademy.upsert({
      where: { id: academy.id },
      update: { ...academy },
      create: { ...academy }
    });
  }

  // incidencias-aula (gate funcional 2026-08-15, decisión 6): las 6 aulas del
  // prototipo son datos INVENTADOS. Se siembran SOLO fuera de producción; allí
  // la tabla arranca VACÍA y la puebla un admin desde /incidencias-aula/aulas.
  if (process.env.NODE_ENV !== 'production') {
    for (const nombre of INCIDENCIAS_AULA_SEED_AULAS) {
      await prisma.aula.upsert({ where: { nombre }, update: {}, create: { nombre } });
    }
  }

  await prisma.auditEvent.create({
    data: { action: 'core.seed', metadata: { users: users.map((u) => u.email) } }
  });

  console.log(
    `Seed aplicado: roles admin/user/orientador_admin + los 3 de incidencias-aula, usuarios dev, ` +
      `${ORIENTADOR_ACADEMIES.length} academias de orientador-ia y ` +
      `${process.env.NODE_ENV !== 'production' ? `${INCIDENCIAS_AULA_SEED_AULAS.length} aulas de demo` : 'sin aulas de demo (producción)'}.`
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
