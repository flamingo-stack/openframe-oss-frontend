#!/usr/bin/env node
/**
 * Full-page skeleton gate (`npm run check:loading`). A thin CLI over THE loading-standard rule engine the lib ships
 * (`src/loading-standard/engine.mjs` of `@flamingo-stack/openframe-frontend-core`, read from the installed lib
 * through `scripts/lib/source-scan.mjs`): an AST reading per component, with constants resolved to their initializer
 * and item components resolved through their import. The engine's header is the full statement of each rule.
 *
 * A paged list's loading skeleton draws its whole page size, and a list fetched with a limit draws that limit, at
 * every width (owner decision, 2026-10-21). MLG's leaderboard drew 8 rows of a 15-row page because its count was
 * `Math.min(pageSize, MLG_ROW_FOLD.desktop)`: a page size capped by a screen's fold.
 *
 * THE ENGINE'S COUNT AND MARK RULES this gate runs, over `app/`, `components/`, `hooks/`, `lib/`:
 *   COUNT_CAP     `Math.min(pageSize | PAGE_SIZE | limit | *_MAX, FOLD | CONSTANT | 8)` (a clamp inside `Math.max`
 *                 and the last page, `Math.min(PAGE_SIZE, total)`, are fine); a count from a comparison or
 *                 literal-against-page-size ternary (`PAGE_SIZE > 6 ? 6 : PAGE_SIZE`); a count named `*FOLD*`,
 *                 `*VISIBLE*`, `*SCREEN*`.
 *   TYPED_COUNT   a literal (after resolving a constant to its initializer) on a skeleton count prop (`skeletonRows`,
 *                 `skeletonCount`, any `(skeleton|loading|placeholder)…(Rows|Count|Lines|Items)`, `count` on
 *                 `LoadingItems`, `rows` / `count` on a `*Skeleton` element), the length of a list drawn while loading
 *                 (`Array.from({ length })`, `Array(n)`, `[...Array(n)]`, `[0, 1, 2].map`), a literal default of a
 *                 count prop, a `?? 10` fallback in a count, and a module constant holding a literal-length list used
 *                 while loading.
 *   COUNT_SOURCE  a skeleton count (`skeletonRows`, `skeletonCount`, `LoadingItems count`, a loading list's length)
 *                 that names neither a page size, a limit, `first`, nor a declared `*_SKELETON_*` constant. A count
 *                 handed in by the caller (a prop, a field of one) is a pass-through, checked where the caller names
 *                 it. A list fetched with a SAFETY CAP rather than a page (`first: 100`) draws a declared
 *                 `*_SKELETON_*` typical count. Text draws a typical line count (`*Lines`, `*Paragraphs`: not a list).
 *   HIDDEN_ITEMS  a loading item hidden per breakpoint (`hidden md:block`, `max-md:hidden`, conditional classes
 *                 included) or a container hiding items past the Nth (`[&>*:nth-child(n+N)]:hidden`) while loading.
 *   ITEM_MARK     a loading list (`LoadingItems`, or a count naming a page size, limit or `*_SKELETON_*` constant)
 *                 whose items carry no `data-loading-item` (or `loadingItemProps(…)`, `listItem`, `listItems`, on the
 *                 item element or inside its component, found through its IMPORT), and the loaded list beside it (the
 *                 other branch of the same condition).
 *   OPTIONAL_MARK in a component that switches on the loading scope, a part left out while loading (`{!loading && …}`)
 *                 or keyed on a read field (`{record.note && …}`, `{record?.x ? <X /> : null}`) without
 *                 `data-loading-optional` (on its element or inside its component). Not counted: an error, offline
 *                 or empty state, the loaded alternatives of an explicit pair (`{loading && <Bar />}` just before), a
 *                 flag-like or config field (`show…`, `is…`, `has…`, `icon`, `children`), a modal or other
 *                 off-page part (a popover's content, an `sr-only` announcement), a part inside a list's per-item
 *                 callback, a link of a ternary chain, and a part where the loading form draws its own version of the
 *                 region (after `if (loading) return …`, the loaded half of `loading ? <A /> : <B />`, an `else`). A
 *                 component that reads the scope but draws no loading form is not switching. The cells of one row
 *                 (`columns`, `cells`) are not list items for ITEM_MARK.
 *
 * A line (or one of the two above it) may opt out with `// full-page-ok: <why>` (or `// loading-standard-ok: <why>`).
 */
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engine, inTrees, loadProject } from './lib/source-scan.mjs';

const RULES = engine.COUNT_RULES;

/** `file:line — why` strings of a finding list. */
const format = findings => engine.formatFindings(findings, { separator: ' — ' });

/**
 * The problems of one file's source, as `file:line — why` strings. `sources` (path -> source) and `srcRoot` let the
 * item components of ITEM_MARK resolve; both are optional for a single-file check.
 */
export function fullPageProblems(file, source, { sources = new Map(), srcRoot = '', path = file } = {}) {
  const base = srcRoot || dirname(resolve(path));
  const all = new Map(sources);
  all.set(resolve(path), source);
  const project = loadProject(base, { sources: all });
  const findings = engine.analyzeProject(project, { rules: RULES, files: [resolve(path)] });
  return format(findings.map(f => ({ ...f, file })));
}

/** Every problem under `root` (the app's `src/`), and how many files were read. */
export function fullPageReport(root) {
  const project = loadProject(root);
  const files = [...project.text.keys()].filter(
    path => project.treeOf.get(path)?.report && inTrees(relative(root, path)),
  );
  const findings = engine.analyzeProject(project, { rules: RULES, files });
  return { problems: format(findings), files: files.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { problems, files } = fullPageReport(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src'));
  if (problems.length) {
    console.error(`check-skeleton-full-page: ${problems.length} problem(s)\n`);
    for (const p of problems) console.error('  ' + p);
    console.error('\nSee the header of scripts/check-skeleton-full-page.mjs.');
    process.exit(1);
  }
  console.log(`check-skeleton-full-page: OK (${files} files)`);
}
