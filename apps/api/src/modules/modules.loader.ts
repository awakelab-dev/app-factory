import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Type } from '@nestjs/common';

/**
 * Descubrimiento de los módulos de negocio de la API (incremento D, bloque 1).
 *
 * Hasta 2026-08-17, cada módulo generado por la Fábrica había que importarlo y
 * listarlo a mano en `app.module.ts` — y ese archivo está (con razón) fuera de
 * lo que el guardarraíl de generación permite tocar al agente. El resultado era
 * un "commit de integración" humano por módulo y, cuando se hacía a medias, un
 * módulo que compilaba y tipaba perfectamente pero **no existía para nadie**
 * (D-049). Aquí el registro desaparece como tarea: una carpeta
 * `src/modules/<slug>/` con un `<slug>.module.ts` que exporte una clase
 * `@Module` está registrada por el hecho de existir.
 *
 * Decisiones de implementación, con sus motivos:
 *  - **En runtime, no con codegen**: un `readdir` + N `import()` cuesta
 *    milisegundos al arrancar y no deja ningún archivo generado que se pueda
 *    quedar viejo. El typecheck sigue cubriendo todos los módulos (el tsconfig
 *    incluye `src/**`, los importe alguien o no).
 *  - **`import()` y no `require()`**: `require` extensionless resuelve `.js` en
 *    `dist/` pero NO resuelve `.ts` bajo vitest, así que un loader con `require`
 *    no se puede ejercitar en los tests — que es justo donde queremos que salte
 *    el fallo. `import()` sobrevive a las dos formas (tsc lo preserva tal cual
 *    en la salida CJS, verificado). El precio es que el descubrimiento es
 *    asíncrono y el módulo raíz pasa a construirse con `AppModule.register()`.
 *  - **El archivo se localiza leyendo el directorio**, no adivinando extensión.
 */

/** Claves de metadatos que deja el decorador `@Module` de Nest. */
const MODULE_METADATA_KEYS = ['imports', 'controllers', 'providers', 'exports'];

/** Extensiones válidas para el archivo de módulo, por orden de preferencia. */
const MODULE_EXTENSIONS = ['.js', '.cjs', '.mjs', '.ts'];

export interface ModuleEntry {
  slug: string;
  /** Ruta absoluta del `<slug>.module.*` encontrado. */
  file: string;
}

export interface ModuleDiscoveryResult {
  /** Clases `@Module` a inyectar en los `imports` del módulo raíz. */
  modules: Type<unknown>[];
  /** Carpetas que NO aportaron exactamente un módulo (las assertea el test). */
  issues: string[];
}

function isNestModuleClass(value: unknown): value is Type<unknown> {
  if (typeof value !== 'function') return false;
  return MODULE_METADATA_KEYS.some((key) => Reflect.hasMetadata(key, value));
}

/**
 * Subcarpetas de `src/modules/` con su archivo de módulo. Una carpeta sin
 * `<slug>.module.*` sale con `file` vacío para que se anote como problema en vez
 * de desaparecer en silencio.
 */
export function listModuleEntries(baseDir: string): ModuleEntry[] {
  return readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((slug) => {
      const files = readdirSync(join(baseDir, slug));
      const match = MODULE_EXTENSIONS.map((ext) => `${slug}.module${ext}`).find((name) => files.includes(name));
      return { slug, file: match ? join(baseDir, slug, match) : '' };
    });
}

/**
 * Parte pura: dadas unas entradas y una forma de cargar cada una, decide qué es
 * un módulo y qué es un problema. Se testea con dobles, sin tocar el disco.
 */
export async function collectNestModules(
  entries: ModuleEntry[],
  load: (entry: ModuleEntry) => Promise<unknown>
): Promise<ModuleDiscoveryResult> {
  const modules: Type<unknown>[] = [];
  const issues: string[] = [];

  for (const entry of entries) {
    if (!entry.file) {
      issues.push(
        `modules/${entry.slug}: no hay ningún "${entry.slug}.module.(ts|js)" — el módulo NO queda registrado en la API.`
      );
      continue;
    }
    let loaded: unknown;
    try {
      loaded = await load(entry);
    } catch (error) {
      issues.push(
        `modules/${entry.slug}: no se pudo cargar "${entry.slug}.module" — ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      continue;
    }
    const found = Object.values((loaded ?? {}) as Record<string, unknown>).filter(isNestModuleClass);
    if (found.length === 0) {
      issues.push(
        `modules/${entry.slug}: "${entry.slug}.module" no exporta ninguna clase @Module — el módulo NO queda registrado en la API.`
      );
      continue;
    }
    if (found.length > 1) {
      issues.push(
        `modules/${entry.slug}: "${entry.slug}.module" exporta ${found.length} clases @Module (${found
          .map((cls) => cls.name)
          .join(', ')}); se espera exactamente una.`
      );
      continue;
    }
    modules.push(found[0] as Type<unknown>);
  }

  return { modules, issues };
}

/** Descubre los módulos de negocio bajo `baseDir` (por defecto, esta carpeta). */
export function discoverBusinessModules(baseDir: string = __dirname): Promise<ModuleDiscoveryResult> {
  return collectNestModules(listModuleEntries(baseDir), (entry) => import(pathToFileURL(entry.file).href));
}
