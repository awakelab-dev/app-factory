/**
 * Carga de dependencias ESM-only desde este paquete CommonJS (docs/08, D-041).
 *
 * `oidc-provider` v9 y `jose` v6 son ESM puros (`"type": "module"`, sin export
 * CJS). `@awk/factory` compila a CommonJS (tsconfig `module: node16`, runtime
 * `node dist/main.js`). Un `import()` dinámico normal lo transpila TypeScript a
 * `require()` bajo `module` CJS → rompe con "require() of ES Module".
 *
 * `new Function('s', 'return import(s)')` construye un `import()` REAL en
 * runtime que TypeScript no reescribe (no lo ve como sintaxis import). Es el
 * patrón estándar y estable para consumir ESM desde CJS en Node. La alternativa
 * (migrar todo apps/factory a ESM) tocaría NestJS, Prisma y ts-node — fuera del
 * alcance mínimo de este incremento.
 */
const dynamicImport = new Function('specifier', 'return import(specifier)') as <T = unknown>(
  specifier: string
) => Promise<T>;

export function importEsm<T = unknown>(specifier: string): Promise<T> {
  return dynamicImport<T>(specifier);
}
