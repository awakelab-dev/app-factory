import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sin `globals: true` en vitest, testing-library no registra su auto-cleanup:
// desmontar entre tests evita duplicar el árbol al renderizar <App /> varias veces.
afterEach(() => {
  cleanup();
});
