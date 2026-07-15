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
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts']
  }
});
