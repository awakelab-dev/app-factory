import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// swc en lugar de esbuild: Nest necesita emitDecoratorMetadata para la DI,
// y esbuild no lo soporta (mismo motivo que apps/api/vitest.config.mts).
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' }
    })
  ],
  // `oxc: false` desde vitest 4: `unplugin-swc` pone `esbuild: false` por dentro
  // y vitest ya no lo respeta ("`esbuild: false` does not have effect any more"),
  // porque la transformación por defecto la hace Oxc. Hoy no rompe nada —los
  // e2e levantan Nest con DI real y pasan, así que swc sigue transformando
  // primero— pero Oxc tampoco soporta `emitDecoratorMetadata`, que es la única
  // razón de ser de este archivo. Se declara explícito para que la garantía no
  // dependa del orden de los plugins, y de paso desaparece el aviso de cada run.
  oxc: false,
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts']
  }
});
