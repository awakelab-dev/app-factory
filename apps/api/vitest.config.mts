import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// swc en lugar de esbuild: Nest necesita emitDecoratorMetadata para la DI,
// y esbuild no lo soporta.
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' }
    })
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts']
  }
});
