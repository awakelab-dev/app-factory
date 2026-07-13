import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sin `globals: true` en vitest, testing-library no registra su auto-cleanup:
// desmontar entre tests evita duplicar el árbol al renderizar <App /> varias veces.
afterEach(() => {
  cleanup();
});

// jsdom no implementa ResizeObserver; recharts (moodle-insights y cualquier
// módulo futuro con gráficos) lo necesita vía ResponsiveContainer.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
    ResizeObserverStub;
}
