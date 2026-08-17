import { Controller, Get, Post } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Roles } from '../auth/auth.decorators';
import { RolesSeedService } from './roles-seed.service';

@Controller('demo')
@Roles('empleado', 'recepcion')
class DemoController {
  @Get()
  list(): void {}

  @Post()
  @Roles('recepcion')
  create(): void {}
}

@Controller('abierto')
class OpenController {
  @Get()
  list(): void {}
}

type UpsertMock = ReturnType<typeof vi.fn<(args: unknown) => Promise<unknown>>>;

function serviceWith(controllers: unknown[], prismaUpsert: UpsertMock = vi.fn(async () => ({}))) {
  const discovery = {
    getControllers: () => controllers.map((metatype) => ({ metatype }))
  } as unknown as DiscoveryService;
  const prisma = { role: { upsert: prismaUpsert } } as never;
  return new RolesSeedService(prisma, discovery, new MetadataScanner());
}

describe('RolesSeedService (siembra de roles desde los @Roles, incremento D bloque 2)', () => {
  let upsert: UpsertMock;

  beforeEach(() => {
    upsert = vi.fn(async () => ({}));
  });

  it('recoge los roles del controller Y de cada handler, sin duplicados', () => {
    const roles = serviceWith([DemoController, OpenController]).collectDeclaredRoles();
    expect([...roles.keys()].sort()).toEqual(['empleado', 'recepcion']);
    expect(roles.get('recepcion')).toEqual(['DemoController']);
  });

  it('siembra los roles base más los declarados, y describe los de módulo con su origen', async () => {
    const service = serviceWith([DemoController], upsert);
    const seeded = await service.seed();

    expect(seeded).toEqual(['admin', 'empleado', 'recepcion', 'user']);
    const calls = upsert.mock.calls.map(([args]) => args as { where: { name: string }; create: { description: string } });
    expect(calls.find((call) => call.where.name === 'admin')?.create.description).toContain('Administración de la plataforma');
    expect(calls.find((call) => call.where.name === 'empleado')?.create.description).toContain('@Roles() en DemoController');
    // Nunca pisa la descripción de un rol que ya existe.
    for (const [args] of upsert.mock.calls) expect((args as { update: unknown }).update).toEqual({});
  });

  it('un controller sin @Roles no aporta roles (endpoint abierto a cualquier autenticado)', async () => {
    const seeded = await serviceWith([OpenController], upsert).seed();
    expect(seeded).toEqual(['admin', 'user']);
  });

  it('si la siembra falla, la API sigue sirviendo y lo deja en el log (no lanza)', async () => {
    const service = serviceWith([DemoController], vi.fn(() => Promise.reject(new Error('BD caída'))));
    await expect(service.seedOnBoot()).resolves.toBeUndefined();
  });
});
