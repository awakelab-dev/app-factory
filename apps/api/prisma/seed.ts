/**
 * Seed de desarrollo: roles base + usuarios dev para dev-login.
 * Ejecutar con `pnpm prisma:seed` (o automáticamente tras `prisma migrate dev`).
 * Idempotente (upserts): se puede correr las veces que haga falta.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

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

  await prisma.auditEvent.create({
    data: { action: 'core.seed', metadata: { users: users.map((u) => u.email) } }
  });

  console.log('Seed aplicado: roles admin/user y usuarios dev.');
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
