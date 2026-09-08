/**
 * Loader hooks shared by the `node --test src/lib/*.test.mjs` suites.
 *
 * Node's ESM resolver requires a file extension and knows nothing about the `@/` alias, while
 * the app's TypeScript sources use both — so a module under test that imports a sibling
 * (`./cookies`) fails to load with ERR_MODULE_NOT_FOUND unless resolution is taught what the
 * bundler already does. Import this for its side effect BEFORE the dynamic `await import()`
 * of the module under test:
 *
 *   import './test-module-resolve.mjs';
 *   const M = await import('./the-module.ts');
 *
 * Package specifiers are untouched — they resolve through node_modules as usual.
 */

import { registerHooks } from 'node:module';

const SRC = new URL('../', import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    const spec = specifier.startsWith('@/') ? `${SRC}${specifier.slice(2)}` : specifier;
    if (/^(\.\.?\/|file:)/.test(spec) && !/\.[a-z]+$/.test(spec)) {
      return nextResolve(`${spec}.ts`, context);
    }
    return nextResolve(spec, context);
  },
});
