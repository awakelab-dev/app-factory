import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // En dev el shell llama a la API por el mismo origen; en prod lo resuelve Nginx.
    proxy: {
      '/api': 'http://localhost:3000',
      // Control plane de la Fábrica (apps/factory, D-030) — levantar con
      // `pnpm --filter=@awk/factory serve` cuando se trabaje en /factory.
      '/factory-api': 'http://localhost:3100'
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}']
  }
});
