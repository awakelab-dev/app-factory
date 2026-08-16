import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sin `globals: true` en vitest, testing-library no registra su auto-cleanup:
// desmontar entre tests evita duplicar el árbol al renderizar <App /> varias veces.
afterEach(() => {
  cleanup();
});

// Espera por defecto de findBy*/waitFor: 1000 ms de serie, demasiado justo para
// los tests que renderizan <App /> entero (sesión → manifests del menú → ruta
// del módulo → fetch de datos son varios ciclos asíncronos encadenados). En un
// runner de CI de 2 vCPU con 20 archivos de test compitiendo, esos ciclos se
// van por encima del segundo y el test falla por reloj, no por comportamiento:
// pasó el 2026-08-16 con `MoodleDashboardPage` ("Unable to find an element with
// the text: Matemáticas I"), en un commit que solo tocaba apps/factory.
// Subirlo no debilita ninguna aserción — un render roto sigue fallando, solo
// que 4 segundos más tarde.
configure({ asyncUtilTimeout: 5000 });

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
