#!/usr/bin/env node
/**
 * Page skeleton gate (`npm run check:loading`, the Loading gates job in .github/workflows/test.yml). A thin CLI over
 * THE loading-standard rule engine the lib ships (`src/loading-standard/engine.mjs` of
 * `@flamingo-stack/openframe-frontend-core`, read from the installed lib through `scripts/lib/source-scan.mjs`): an
 * AST reading through the TypeScript compiler API, per COMPONENT (a function body), with imports, `as` renames, local
 * aliases (`const X = YSkeleton`), namespace imports and `createElement(Y)` resolved, and every condition read as an
 * expression however many lines it spans. The engine's header is the full statement of each rule.
 *
 * A loading state is drawn by the COMPONENTS a screen is made of, never by the screen. While a read has not answered,
 * the screen renders itself in the lib's loading scope (`LoadingWhen` for a client read, `LoadingSuspense` /
 * `LoadingFallback` for a Suspense boundary), where every component draws its own skeleton.
 *
 * THE ENGINE'S RULES this gate runs, anywhere in `app/`, `components/`, `lib/`, `hooks/`:
 *   ONE_SWITCH            `<YSkeleton>` (an alias, `createElement(YSkeleton)`, `{YSkeleton}` handed to a prop) rendered
 *                         outside Y's module when Y switches itself: render `<Y />`. A `*Skeleton` function may
 *                         compose a child's skeleton unless its module renders `<Y />` elsewhere.
 *   NO_SCOPE_SWITCH       the same render where Y never switches itself (fails here; Y should switch on the scope).
 *   PROP_ONLY_SWITCH      a component that draws a skeleton on its own boolean (a prop, `props.x`, a local made from
 *                         them) and never calls `useLoadingScope()` in that component.
 *   NOTHING_WHILE_LOADING `if (loading) return null`, `loading ? null : <X />`, `{!loading && <X />}` (in a component
 *                         that does not switch), and the same on read data still missing (`if (!data) return null`,
 *                         `data ? <X /> : null`), unless the read answered above it in that component.
 *   SPINNER               `animate-spin` off an action's progress icon (`Loader2`, `RefreshCw`), and a progress icon
 *                         keyed on a read flag or returned as the whole output.
 *   LOADER_COMPONENT      `PageLoader`, `CompactPageLoader`, `ContentLoader`, `CardLoader`, `DetailLoader`,
 *                         `FormLoader`, `ListLoader`, `ChatCardLoader`, `OpenmspHeartbeatLoader`, `Spinner`.
 *   LOADING_TEXT          "Loading"/"Checking" as a text node, a "Loading…" string or a "Loading" placeholder (a
 *                         status announcement, `label`, `aria-label` and `title` excepted).
 *   OWN_PULSE             `animate-pulse`, `animate-[pulse…`, `bg-ods-skeleton`, `animation-duration`.
 *   SUSPENSE_FALLBACK     a `Suspense` / `React.Suspense` with no fallback, or `null`, `undefined`, `<></>`, `''`.
 *   HAND_PAIR             a hand `<Suspense fallback={<LoadingFallback>…}>` (use `LoadingSuspense`) or a hand
 *                         `<LoadingRegion>` around a `<LoadingScope>` (use `LoadingFallback`).
 *   WHOLE_VIEW_SKELETON   a component named `*PageSkeleton`, `*ScreenSkeleton`, `*DetailSkeleton`, `*ArticleSkeleton`,
 *                         `*ViewSkeleton`, `*HomeSkeleton`, `*DeckSkeleton`, `*EditorSkeleton`, `*CenterSkeleton`,
 *                         `*CatalogSkeleton`, `*FormSkeleton`, `*LayoutSkeleton`, `*LoadingLayout`; `DetailPageSkeleton`.
 *   FOLD_PROP             a `fold` prop (the full count: `skeletonCount`).
 *   DEPRECATED_SKELETON   a skeleton the installed lib marks `@deprecated` (read from its source).
 *   RETIRED_API           the first-paint memory, stand-in data (`standIn`, `Hold*`), `StreamedPage` `skeleton` /
 *                         `memory` / `remember`.
 * The count and mark rules run in `check-skeleton-full-page.mjs`.
 *
 * THIS REPOSITORY'S PAGE-CODE RULES (kept here, on the engine's `pageCodeFindings`):
 * PAGE CODE is every route file under `app/` (`page`, `layout`, `loading`, `template`, `not-found`, `error`), every
 * other file in a ROUTE FOLDER (a folder under `app/` holding a `page.tsx` or a `layout.tsx`), every screen file
 * (`*-page.tsx`, `*-page-client.tsx`, `*-page-ssr.tsx`) and every `.tsx` under `lib/`. Page code draws no skeleton:
 * no primitive (`UnifiedSkeleton`, `TextLineSkeleton`, `TextSkeleton.*`, `MediaSkeleton.*`, `InteractiveSkeleton.*`,
 * `TextHold`, `LayoutHold`, `animate-pulse`), no component declared `*Skeleton`, no route `loading.tsx`, and (outside
 * `lib/`) no component's skeleton rendered, a Suspense `fallback=` included.
 *
 * ALLOWED (no rule fires): a `next/dynamic` `loading: () => <YSkeleton />` fallback; a registry entry's own
 * `skeleton:` slot drawing the card its `render:` draws; an action's progress icon; `return null` after a suspending
 * read or a loading branch; error and empty states; a ternary choosing between two forms of one slot.
 * A line may opt out with `// loading-standard-ok: <why>` (on it or one of the two lines above).
 *
 * Exit 1 on any finding (a parent choosing a child's skeleton fails whether or not the child switches: the frontend
 * converted every one, CU-17tkuw5z69a, so a new one is a regression).
 */
import { existsSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engine, inTrees, installedLibSource, loadProject } from './lib/source-scan.mjs';

const root = process.env.PAGE_SKELETON_GATE_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const ROUTE_FILE = /^(page|layout|loading|template|not-found|error)\.tsx$/;
const SCREEN_FILE = /-page(-ssr|-client)?\.tsx$/;
const COUNT_RULES = new Set(engine.COUNT_RULES);

/** Whether a file under `app/` is page code (see the header). */
function isPageFile(rel, base) {
  const name = basename(rel);
  if (ROUTE_FILE.test(name) || SCREEN_FILE.test(name)) return true;
  const folder = dirname(join(base, rel));
  return existsSync(join(folder, 'page.tsx')) || existsSync(join(folder, 'layout.tsx'));
}

/** What breaks the standard (`violations`, exit 1). `warnings` stays for callers that read it (always empty here). */
export function pageSkeletonReport(base = root) {
  const violations = [];
  const lib = installedLibSource(base);
  // Without the installed lib's source the lib-reading rules would pass by reading nothing, so its absence fails.
  if (!existsSync(lib))
    violations.push(
      'node_modules/@flamingo-stack/openframe-frontend-core:0: the installed lib ships no src/ to index (install it)',
    );
  const project = loadProject(base);
  const files = [...project.text.keys()].filter(path => {
    if (!project.treeOf.get(path)?.report) return false;
    return inTrees(relative(base, path));
  });
  const rules = engine.CONFIGS.frontend.rules.filter(rule => !COUNT_RULES.has(rule));
  const findings = engine.analyzeProject(project, { rules, files });

  // Page code (see the header).
  for (const path of files) {
    const rel = relative(base, path);
    const page = inTrees(rel, ['lib'])
      ? path.endsWith('.tsx')
      : inTrees(rel, ['app'])
        ? path.endsWith('.tsx') && isPageFile(rel, base)
        : inTrees(rel, ['components'])
          ? SCREEN_FILE.test(basename(path))
          : false;
    if (!page) continue;
    if (basename(path) === 'loading.tsx') violations.push(`${rel}:0: a route-level loading.tsx`);
    findings.push(...engine.pageCodeFindings(project, path, rel, { components: !inTrees(rel, ['lib']) }));
  }
  violations.push(...engine.formatFindings(findings));
  return { violations, warnings: [] };
}

export function pageSkeletonViolations(base = root) {
  return pageSkeletonReport(base).violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { violations } = pageSkeletonReport();
  if (violations.length > 0) {
    console.error(
      `check-page-skeletons: ${violations.length} place(s) that break the loading standard. A screen's loading state is the ` +
        'screen itself in a loading scope (LoadingWhen / LoadingSuspense from the lib) where every component draws its own skeleton.',
    );
    for (const v of violations) console.error(`  ${v}`);
    process.exit(1);
  }
  console.log('check-page-skeletons: OK (no screen draws a skeleton)');
}
