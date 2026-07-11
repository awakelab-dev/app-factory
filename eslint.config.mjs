import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Config raíz de ESLint (flat). Cada workspace la reutiliza vía `eslint src`.
 * Las reglas custom de arquitectura (p. ej. prohibir imports cross-módulo)
 * se añadirán aquí cuando exista el primer módulo generado.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      'legacy/**',
      '**/*.d.ts',
      '**/generated/**'
    ]
  },
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }]
    }
  },
  {
    // La DI de NestJS necesita imports de valor (emitDecoratorMetadata):
    // forzar `import type` rompería la inyección por constructor.
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off'
    }
  }
);
