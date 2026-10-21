/**
 * What both loading gates (`check-page-skeletons.mjs`, `check-skeleton-full-page.mjs`) read the source with: THE
 * loading-standard rule engine the lib ships (`@flamingo-stack/openframe-frontend-core/src/loading-standard/engine.mjs`,
 * an AST reading through the TypeScript compiler API), imported by file path from the installed lib, and one project
 * built over this app's `src/` with the installed lib's `src/` indexed beside it (which lib components switch
 * themselves, which skeletons the lib marks `@deprecated`, which item components mark their items).
 *
 * The engine is the installed one, never a copy: the rules move with the lib pin.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIB_PACKAGE = join('node_modules', '@flamingo-stack', 'openframe-frontend-core');
export const ENGINE_PATH = join(APP, LIB_PACKAGE, 'src', 'loading-standard', 'engine.mjs');

if (!existsSync(ENGINE_PATH)) {
  console.error(
    `loading gates: the installed lib ships no loading-standard engine (${ENGINE_PATH}); install a lib release that has it`,
  );
  process.exit(1);
}

/** The engine module (Project, analyzeProject, CONFIGS, …). */
export const engine = await import(pathToFileURL(ENGINE_PATH).href);

/** The engine's failing / passing example per rule (`rule-examples.mjs`, shipped beside it): the gate test runs them. */
export const { RULE_EXAMPLES } = await import(pathToFileURL(join(dirname(ENGINE_PATH), 'rule-examples.mjs')).href);

/** The trees the gates report on, under `src/`. */
export const TREES = ['app', 'components', 'lib', 'hooks'];

/** The installed lib's `src/` beside an app's `src/` (a fixture project carries its own). */
export function installedLibSource(srcRoot) {
  return join(srcRoot, '..', LIB_PACKAGE, 'src');
}

/**
 * The project over `srcRoot` (`@/` resolves to it), reported, with the installed lib indexed. `sources`
 * (path -> text) replaces reading `srcRoot` from disk (a single file).
 */
export function loadProject(srcRoot, { sources } = {}) {
  const lib = installedLibSource(srcRoot);
  const trees = [{ dir: srcRoot, report: true, sources }];
  if (existsSync(lib)) trees.push({ dir: lib, report: false });
  return new engine.Project({ trees });
}

/** Whether a path (relative to `src/`) is under one of the reported `TREES`. */
export function inTrees(rel, dirs = TREES) {
  return dirs.some(dir => rel === dir || rel.startsWith(`${dir}/`));
}
