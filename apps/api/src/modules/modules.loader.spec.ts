import { Module } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { collectNestModules, discoverBusinessModules, listModuleEntries } from './modules.loader';

@Module({ providers: [] })
class UnoModule {}

@Module({ controllers: [] })
class OtroModule {}

class NoEsModulo {}

/**
 * Este test sustituye al "coste fijo" que pagaba cada módulo nuevo: antes había
 * que acordarse de editar `app.module.ts`, y si no se hacía, el módulo compilaba
 * pero no existía (D-049, hallazgo 7). Ahora el registro es automático y lo que
 * hay que vigilar es que ninguna carpeta se quede fuera del descubrimiento por
 * no respetar la convención `<slug>/<slug>.module.ts`.
 */
describe('descubrimiento de módulos de negocio (src/modules/<slug>/<slug>.module.ts)', () => {
  it('cada carpeta de src/modules/ tiene su archivo de módulo', () => {
    const entries = listModuleEntries(__dirname);
    expect(entries.length).toBeGreaterThanOrEqual(6);
    expect(entries.filter((entry) => !entry.file)).toEqual([]);
    expect(entries.map((entry) => entry.slug)).toContain('reserva-salas');
  });

  it('carga un @Module por carpeta, sin problemas — incluido reserva-salas, el último generado', async () => {
    const { modules, issues } = await discoverBusinessModules(__dirname);
    expect(issues).toEqual([]);
    expect(modules).toHaveLength(listModuleEntries(__dirname).length);
    const names = modules.map((mod) => mod.name);
    expect(names).toContain('ReservaSalasModule');
    expect(names).toContain('IncidenciasAulaModule');
  });

  it('anota (sin lanzar) la carpeta sin archivo, la que no exporta @Module, la que exporta dos y la que revienta al cargar', async () => {
    const { modules, issues } = await collectNestModules(
      [
        { slug: 'bien', file: '/x/bien/bien.module.ts' },
        { slug: 'sin-archivo', file: '' },
        { slug: 'sin-modulo', file: '/x/sin-modulo/sin-modulo.module.ts' },
        { slug: 'dos', file: '/x/dos/dos.module.ts' },
        { slug: 'roto', file: '/x/roto/roto.module.ts' }
      ],
      async (entry) => {
        if (entry.slug === 'bien') return { UnoModule };
        if (entry.slug === 'sin-modulo') return { NoEsModulo, algo: 42 };
        if (entry.slug === 'dos') return { UnoModule, OtroModule };
        throw new Error('Cannot find module');
      }
    );
    expect(modules).toEqual([UnoModule]);
    expect(issues).toHaveLength(4);
    expect(issues.join('\n')).toContain('modules/sin-archivo');
    expect(issues.join('\n')).toContain('modules/sin-modulo');
    expect(issues.join('\n')).toContain('modules/dos');
    expect(issues.join('\n')).toContain('modules/roto');
  });
});
