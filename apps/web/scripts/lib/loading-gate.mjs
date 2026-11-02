/**
 * THE loading gate of this app (`npm run check:loading`, the Loading gates job in .github/workflows/test.yml): one
 * run of the loading-standard rule engine the lib ships (`src/loading-standard/engine.mjs` of
 * `@flamingo-stack/openframe-frontend-core`, imported by file path from the INSTALLED lib, never a copy: the rules
 * move with the lib pin) under its `CONFIGS.frontend`, over this app's `src/` with the installed lib's `src/` indexed
 * beside it (which lib components switch themselves, which skeletons it marks `@deprecated`, which item components
 * mark their items). The rules, the page code, the allowed forms and the opt-out form are stated once, in the engine's
 * header; nothing here restates them.
 *
 * `npm run check:loading` runs it once, as `check-page-skeletons.mjs`; `check-skeleton-full-page.mjs` is the same
 * run under its older name, kept as an alias for callers that still name it (never run beside the first).
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIB_PACKAGE = join('node_modules', '@flamingo-stack', 'openframe-frontend-core');
const ENGINE_PATH = join(APP, LIB_PACKAGE, 'src', 'loading-standard', 'engine.mjs');

if (!existsSync(ENGINE_PATH)) {
  console.error(
    `loading gate: the installed lib ships no loading-standard engine (${ENGINE_PATH}); install a lib release that has it`,
  );
  process.exit(1);
}

const engine = await import(pathToFileURL(ENGINE_PATH).href);

/** The engine's failing / passing example per rule (`rule-examples.mjs`, shipped beside it). */
export const { RULE_EXAMPLES } = await import(pathToFileURL(join(dirname(ENGINE_PATH), 'rule-examples.mjs')).href);

/**
 * Every finding under `srcRoot` (an app's `src/`, `@/` resolving to it), as `file:line: message [RULE]` lines. The
 * installed lib's `src/` must be there to index: without it the lib-reading rules would pass by reading nothing.
 */
export function loadingReport(srcRoot = join(APP, 'src')) {
  const lib = join(srcRoot, '..', LIB_PACKAGE, 'src');
  if (!existsSync(lib)) return [`${LIB_PACKAGE}:0: the installed lib ships no src/ to index (install it) [GATE]`];
  const project = new engine.Project({
    trees: [
      { dir: srcRoot, report: true },
      { dir: lib, report: false },
    ],
  });
  return engine.formatFindings(engine.analyzeProject(project, engine.CONFIGS.frontend));
}

/** Run the gate as `name`: print the findings and exit 1 on any. */
export function runLoadingGate(name) {
  const findings = loadingReport();
  if (findings.length) {
    console.error(`${name}: ${findings.length} place(s) that break the loading standard (see the header of the lib's`);
    console.error('src/loading-standard/engine.mjs for each rule):');
    for (const finding of findings) console.error(`  ${finding}`);
    process.exit(1);
  }
  console.log(`${name}: OK (the loading standard holds)`);
}
