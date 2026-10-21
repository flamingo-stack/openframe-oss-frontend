#!/usr/bin/env node
/**
 * Page skeleton gate (`npm run check:loading`, the Loading gates job in .github/workflows/test.yml). Ported from the
 * hub's `scripts/check-page-skeletons.mjs` (multi-platform-hub), the loading standard both repositories follow.
 *
 * A loading state is drawn by the COMPONENTS a screen is made of, never by the screen. While a read has not
 * answered, the screen renders itself in the lib's loading scope: `LoadingWhen loading={…}` for a client read,
 * `LoadingFallback` for a Suspense fallback (both from `@flamingo-stack/openframe-frontend-core`), where every
 * component draws its own placeholder; a screen that hand-draws bars and boxes drifts from the layout it stands for.
 *
 * PAGE CODE is (everything under `src/`):
 *   - every route file under `app/` (`page`, `layout`, `loading`, `template`, `not-found`, `error`);
 *   - every other file in a ROUTE FOLDER: a folder under `app/` holding a `page.tsx` or a `layout.tsx` (a route's
 *     `*-content.tsx`, `*-client.tsx` beside its page). A folder without one (`components/`, `hooks/`, `steps/`)
 *     is component code;
 *   - every screen, wherever it lives: a file named `*-page.tsx`, `*-page-client.tsx`;
 *   - every `.tsx` under `lib/`.
 * Everything else is component code, where a component's loading state belongs.
 *
 * THE predicate: page code draws no skeleton. It fails on the skeleton
 * primitives (`UnifiedSkeleton`, `TextLineSkeleton`, `TextSkeleton.*`,
 * `MediaSkeleton.*`, `InteractiveSkeleton.*`, `TextHold`, `LayoutHold`,
 * `animate-pulse`), on a component declared with a `Skeleton` name, and on any
 * `loading.tsx` route file (a route-level loading state is a hand-drawn page
 * skeleton). Using a component's own exported skeleton is not drawing one and
 * is allowed.
 *
 * And page code renders no component's skeleton either, a Suspense `fallback=`
 * included: a component switches to its own skeleton itself (its ONE switch,
 * `useLoadingScope() || its data not here yet`), so a page renders the
 * component unconditionally and never picks `<NameSkeleton />` for it. A
 * Suspense fallback is the SAME component in a loading scope
 * (`components/shared/loading-fallback.tsx`: `fallback={<LoadingFallback><Name /></LoadingFallback>}`).
 * A line may opt out with `// loading-standard-ok: <why>`.
 *
 * THE ONE EXEMPTION: a `next/dynamic` `loading:` fallback. `dynamic(() =>
 * import('…'), { loading: () => <NameSkeleton /> })` renders while the
 * component's CODE is still being fetched, so the component cannot draw itself
 * in a loading scope yet: its own exported skeleton is the only thing that can
 * stand for it. Only the arrow on the `loading: () =>` line is exempt (to the
 * end of that line); a skeleton anywhere else in the file is checked as usual,
 * and a `loading:` fallback that is not the dynamic component's own skeleton is
 * still a review finding.
 *
 * AND ONE REGISTRY SLOT: a registry entry that pairs a `skeleton: (…) =>` slot
 * with a `render: (item, …) =>` slot (the chat's entity cards, the related
 * content rail) draws its skeleton while the record is still being fetched by
 * id, before there is an item for the card to switch on. That arrow may render
 * ONLY its own entry's type skeleton: `<XSkeleton>` where the entry's `render`
 * draws `<X>` (or its chat wrapper `<…Chat…>`, `BlogChatCard` for `BlogCard`).
 * Any other skeleton in the slot, or a slot whose entry renders something else,
 * is checked as usual.
 *
 * And anywhere in `src/`: no component named `*PageSkeleton`, `*ScreenSkeleton`,
 * `*DetailSkeleton`, `*ArticleSkeleton`, `*ViewSkeleton`, `*HomeSkeleton`,
 * `*DeckSkeleton`, `*EditorSkeleton`, `*CenterSkeleton`, `*CatalogSkeleton`
 * or `*LoadingLayout`, and no use of the lib's generic `DetailPageSkeleton`. A
 * skeleton of a whole page (or of a whole view, article, home screen, deck,
 * editor, help center or catalog, or a
 * "loading layout" standing in for one) is a per-screen skeleton wherever it
 * lives and whatever it is called: a view's loading state is the view itself
 * rendered in a loading scope. A PANEL's own skeleton is a component's
 * skeleton and is allowed; a parent rendering it is caught by ONE SWITCH below.
 *
 * ONE SWITCH, PER COMPONENT (`app/` and `components/`):
 * a component whose module already switches itself (it calls
 * `useLoadingScope`) is never handed its skeleton by anyone else.
 * `<XSkeleton />` rendered outside X's own module (the file declaring `X` or
 * `XSkeleton`) and outside a `*Skeleton` function (a component's own skeleton
 * composing a child's, a list's skeleton folding its own items) is a parent
 * choosing a child's skeleton: render `<X />`, which draws its own. FAILS.
 * The `*Skeleton` exemption is narrow: `PSkeleton` rendering `<XSkeleton />`,
 * when `P` itself (its declaration in the same module) renders `<X />` and X
 * switches itself, is reported (P's skeleton should render `<X />` as well).
 * Reported with the NO SCOPE SWITCH findings below; in this repository both FAIL.
 *
 * NO SCOPE SWITCH (a failure here; a warning in the hub): the same render, where X's module never calls
 * `useLoadingScope`. X does not switch at all, so the parent's choice is the
 * only switch there is: X should draw its own skeleton on `useLoadingScope()`
 * and the parent render `<X />`.
 *
 * For both: only a component that exists counts (`XSkeleton` with a declared `X`; a
 * skeleton primitive such as `TextLineSkeleton` names no component). The
 * `next/dynamic` `loading:` line and the registry slot stay exempt (above),
 * and so does a line marked `// loading-standard-ok: <why>`.
 *
 * And the rest of the loading standard, anywhere in `src/`:
 *   - `StreamedPage` takes a `placeholder`, never a `skeleton`, `memory` or
 *     `remember` (the loading state is the page drawn with an EMPTY placeholder:
 *     every component draws its own skeleton, never invented data);
 *   - the KV first-paint memory is gone (`pageFirstPaint`,
 *     `firstPaintKvStore`, `createFirstPaintMemory`, the careers and homepage
 *     memories): a loading state is never sized from a stored render;
 *   - no stand-in data: the retired `standIn` / `Hold` family is never used
 *     again (a loading state draws skeletons, never made-up words);
 *   - no spinner as a loading state: `animate-spin` only on an action's
 *     progress icon (`Loader2`, `RefreshCw`), never a hand-made spinner, and
 *     never one of the lib's loader components (`PageLoader`, `CompactPageLoader`,
 *     `ContentLoader`, `CardLoader`, `DetailLoader`, `FormLoader`, `ListLoader`,
 *     `ChatCardLoader`, `OpenmspHeartbeatLoader`) or a `Spinner`;
 *   - never nothing: `loading ? null : <X />` and `if (loading) return null` leave
 *     the slot empty (render X in a loading scope), and a `<Suspense>` with no
 *     fallback is the same (use the lib's `LoadingSuspense`);
 *   - never "Loading" text, with or without an ellipsis, as a text node;
 *   - never a skeleton the installed lib marks `@deprecated` (read from its source,
 *     so a skeleton the lib retires is refused here the day the pin moves).
 *
 * The `next/dynamic` exemption holds only for a `loading:` arrow INSIDE a
 * `dynamic(` (or `dynamic<Props>(`) call, never a `loading:` key of another object.
 */
import { existsSync } from 'node:fs';
import { join, dirname, resolve, relative, basename } from 'node:path';
import {
  declarationIndex,
  dynamicLoadingSpans,
  enclosingDeclaration,
  isComment,
  lineOf,
  optedOut,
  readSources,
} from './lib/source-scan.mjs';

const root = process.env.PAGE_SKELETON_GATE_ROOT || resolve(dirname(new URL(import.meta.url).pathname), '..', 'src');

const PRIMITIVES = [
  [/\bUnifiedSkeleton\b/, 'UnifiedSkeleton'],
  [/\bTextLineSkeleton\b/, 'TextLineSkeleton'],
  [/\bTextSkeleton\./, 'TextSkeleton'],
  [/\bMediaSkeleton\./, 'MediaSkeleton'],
  [/\bInteractiveSkeleton\./, 'InteractiveSkeleton'],
  [/\bTextHold\b/, 'TextHold'],
  [/\bLayoutHold\b/, 'LayoutHold'],
  [/\banimate-pulse\b/, 'animate-pulse'],
  [/\b(?:function|const)\s+[A-Z][A-Za-z0-9]*Skeleton\b/, 'a component declared as a skeleton'],
];
const ROUTE_FILE = /^(page|layout|loading|template|not-found|error)\.tsx$/;
const SCREEN_FILE = /-page(-ssr|-client)?\.tsx$/;

/** Every source file under `dirs` of `base`, read once: path -> { rel, source, lines } (tests and stories left out). */
function readTree(base, dirs) {
  const tree = new Map();
  for (const [full, source] of readSources(
    dirs.map(dir => join(base, dir)),
    { ts: true },
  )) {
    tree.set(full, { rel: relative(base, full), source, lines: source.split('\n') });
  }
  return tree;
}

/** Whether a file under `app/` is page code (see the header). */
function isPageFile(rel, base = root) {
  const name = basename(rel);
  if (ROUTE_FILE.test(name) || SCREEN_FILE.test(name)) return true;
  const folder = dirname(join(base, rel));
  return existsSync(join(folder, 'page.tsx')) || existsSync(join(folder, 'layout.tsx'));
}

const MEMORY =
  /\b(?:pageFirstPaint|firstPaintKvStore|createFirstPaintMemory|careersSeed|refreshCareersSeed|lastKnownHomeLayout|rememberHomeLayout)\b/g;
const SCREEN_SKELETON =
  /\b(?:function|const)\s+([A-Z][A-Za-z0-9]*(?:(?:Page|Screen|Detail|Article|View|Home|Deck|Editor|Center|Catalog)Skeleton|LoadingLayout))\b/;
const OPT_OUT = 'loading-standard-ok:';

/**
 * ONE SWITCH, PER COMPONENT (see the header): `<XSkeleton />` rendered outside X's own module and outside a
 * `*Skeleton` function, when X's module switches itself (calls `useLoadingScope`). `tree` is reported on; `libTree`
 * (the installed lib) is only indexed: the lib gates its own code.
 */
function foreignSkeletonRenders(tree, libTree) {
  const violations = [];
  const warnings = [];
  const all = new Map([...libTree, ...tree]);
  const declaredIn = declarationIndex(new Map([...all].map(([full, { source }]) => [full, source])));
  const switches = full => /\buseLoadingScope\s*\(/.test(all.get(full)?.source ?? '');
  for (const [full, { rel, source, lines }] of tree) {
    const dynamicSpans = dynamicLoadingSpans(source);
    // AND ONE REGISTRY SLOT (see the header): a `skeleton:` arrow up to its entry's `render:`, with the components
    // that `render` draws.
    const registrySlots = [];
    for (const m of source.matchAll(/\bskeleton:\s*(?:\([^)]*\)|[A-Za-z_$][A-Za-z0-9_$]*)\s*=>/g)) {
      const renderAt = source.indexOf('render:', m.index);
      const nextSlot = source.indexOf('skeleton:', m.index + 1);
      if (renderAt < 0 || renderAt - m.index > 1500 || (nextSlot >= 0 && nextSlot < renderAt)) continue;
      const renderEnd = nextSlot >= 0 && nextSlot > renderAt ? Math.min(nextSlot, renderAt + 1500) : renderAt + 1500;
      const renders = new Set(
        [...source.slice(renderAt, renderEnd).matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)].map(r => r[1].replace('Chat', '')),
      );
      registrySlots.push({ start: m.index, end: renderAt, renders });
    }
    for (const m of source.matchAll(/<([A-Z][A-Za-z0-9]*)Skeleton\b/g)) {
      const component = m[1];
      if (registrySlots.some(({ start, end, renders }) => m.index > start && m.index < end && renders.has(component)))
        continue;
      const own = [...(declaredIn.get(component) ?? []), ...(declaredIn.get(`${component}Skeleton`) ?? [])];
      if (own.includes(full)) continue;
      const modules = [...(declaredIn.get(component) ?? [])];
      // A skeleton with no component of that name (a primitive such as `TextLineSkeleton`) is not a component's switch.
      if (!modules.length) continue;
      if (dynamicSpans.some(([start, end]) => m.index > start && m.index < end)) continue;
      const switched = modules.some(switches);
      const enclosing = enclosingDeclaration(source, m.index);
      const line = lineOf(source, m.index);
      if (isComment(lines[line - 1]) || optedOut(lines, line - 1, OPT_OUT)) continue;
      if (/Skeleton$/.test(enclosing)) {
        // A parent's own skeleton may compose a child's, UNLESS the parent itself renders `<Child />` (in this module)
        // and the child switches itself: the parent's skeleton then renders `<Child />` too (see the header).
        const parent = enclosing.replace(/Skeleton$/, '');
        const parentRendersChild = [...source.matchAll(new RegExp(`<${component}(?=[\\s/>])`, 'g'))].some(
          r => enclosingDeclaration(source, r.index) === parent,
        );
        if (!(parentRendersChild && switched)) continue;
        warnings.push(
          `${rel}:${line}: <${component}Skeleton> rendered by ${enclosing}, while ${parent} renders <${component} />, which switches itself (render <${component} /> in ${enclosing} too: one switch per component)`,
        );
        continue;
      }
      if (switched) {
        violations.push(
          `${rel}:${line}: <${component}Skeleton> rendered outside ${component}'s module, which switches itself (render <${component} />: one switch per component)`,
        );
      } else {
        warnings.push(
          `${rel}:${line}: <${component}Skeleton> rendered outside ${component}'s module, which never switches itself (${component} should draw its own skeleton on useLoadingScope(), and this place render <${component} />)`,
        );
      }
    }
  }
  return { violations, warnings };
}

/** The `*Skeleton` components the lib's source marks `@deprecated` (the JSDoc above their export, line comments between). */
export function deprecatedLibSkeletons(libTree) {
  const names = new Set();
  for (const { source } of libTree.values()) {
    for (const m of source.matchAll(
      /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*(?:\/\/[^\n]*\n\s*)*export\s+(?:function|const)\s+([A-Z][A-Za-z0-9]*Skeleton)\b/g,
    )) {
      if (m[1].includes('@deprecated')) names.add(m[2]);
    }
  }
  return names;
}

// The rest of the standard, line by line, anywhere in `src/` (a line may opt out with `// loading-standard-ok: <why>`).
const STANDARD = [
  [/\bUnifiedSkeleton\b[^>]*\bh-\[[0-9.]*lh\]/, 'a text bar built from UnifiedSkeleton (use TextLineSkeleton)'],
  [
    /\banimate-pulse\b|animation-duration|\bbg-ods-skeleton\b/,
    'a pulse or skeleton colour of its own (use the lib skeletons, LIVE_PULSE_CLASS for live dots)',
  ],
  [/fallback=\{\s*null\s*\}/, 'a Suspense fallback of null (draw the component skeleton)'],
  [/fallback=\{<[^}]*?>[^<{]*\bLoading\b/, 'a Suspense fallback of "Loading" text (draw the component skeleton)'],
  [
    /^(?!.*<(?:Loader2|RefreshCw)\b).*\banimate-spin\b/,
    'a spinner as a loading state (animate-spin only on an action progress icon: Loader2, RefreshCw)',
  ],
  [
    // An action's progress icon spins; a READ's state never does: a spinner keyed on a read flag, or returned as the
    // whole output, is a spinner standing for a loading state.
    /\b(?:loading|isLoading|isFetching)\b[^\n]*<(?:Loader2|RefreshCw)\b[^>]*animate-spin|\breturn\s*\(?\s*<(?:Loader2|RefreshCw)\b/,
    'a spinner as a loading state (a progress icon belongs to an action, never to a read)',
  ],
  [
    />\s*(Loading|Checking)\b[^<{]*(\.\.\.|…)\s*<|['"`](Loading|Checking)\b[^'"`]*(\.\.\.|…)['"`]/,
    '"Loading…" text as a loading state (draw the component skeleton)',
  ],
  [/>\s*Loading\b[^<{]*</, '"Loading" text as a loading state (draw the component skeleton)'],
  [/\bplaceholder=\{?\s*['"`]Loading\b/, '"Loading" as a placeholder (draw the field in a loading scope)'],
  [
    /<(?:PageLoader|CompactPageLoader|ContentLoader|CardLoader|DetailLoader|FormLoader|ListLoader|ChatCardLoader|OpenmspHeartbeatLoader|Spinner)\b/,
    'a loader component as a loading state (render the components in a loading scope)',
  ],
  [
    /\b(?:loading|isLoading|isPending|isFetching)\s*\?\s*null\s*:\s*</,
    'nothing drawn while loading (render the component in a loading scope)',
  ],
  [
    /if\s*\(\s*(?:loading|isLoading|isPending|isFetching)\s*\)\s*(?:\{\s*)?return\s+null\b/,
    'nothing drawn while loading (render the component in a loading scope)',
  ],
];

// Whole-file rules (see the header).
const SUSPENSE_TAG = /<Suspense\b([^>]*)>/g;
const NULL_WHEN_MISSING = /if\s*\(\s*!\s*[A-Za-z_$][\w$.]*\s*\)\s*(?:\{\s*)?return\s+null\b/g;
const READ_ANSWERED =
  /\buseLoadingScope\s*\(|\bif\s*\([^)]*\b(?:loading|isLoading|isFetching|isPending)\b|\b(?:useLazyLoadQuery|usePreloadedQuery|useFragment|usePaginationFragment|useRefetchableFragment|useSuspenseQuery)\s*[<(]|\buse\s*\(/;
const PROP_SWITCH =
  /\bif\s*\(\s*(?:loading|isLoading)\s*\)\s*(?:\{\s*)?return\s*\(?\s*<[A-Z]\w*Skeleton\b|\b(?:loading|isLoading)\s*\?\s*\(?\s*<[A-Z]\w*Skeleton\b/g;

/** What breaks the standard (`violations`, exit 1) and what is reported only (`warnings`: NO SCOPE SWITCH). */
export function pageSkeletonReport(base = root) {
  const violations = [];
  const report = (rel, line, why) => violations.push(`${rel}:${line}: ${why}`);
  const tree = readTree(base, ['app', 'components', 'lib', 'hooks']);
  const inTrees = (full, dirs) => dirs.some(dir => full.startsWith(join(base, dir) + '/'));

  // The installed lib's source (see foreignSkeletonRenders): `node_modules` beside `src/`. Without it the two lib
  // checks would pass by reading nothing, so its absence fails.
  const installedLib = join(base, '..', 'node_modules', '@flamingo-stack', 'openframe-frontend-core', 'src');
  if (!existsSync(installedLib)) {
    report(
      'node_modules/@flamingo-stack/openframe-frontend-core',
      0,
      'the installed lib ships no src/ to index (install it)',
    );
  }
  const libTree = existsSync(installedLib) ? readTree(installedLib, ['.']) : new Map();

  // Whole-view skeletons, anywhere.
  for (const [full, { rel, lines }] of tree) {
    if (!inTrees(full, ['app', 'components', 'lib'])) continue;
    lines.forEach((line, i) => {
      if (isComment(line) || optedOut(lines, i, OPT_OUT)) return;
      const match = SCREEN_SKELETON.exec(line);
      if (match) report(rel, i + 1, `${match[1]} (a whole-view skeleton)`);
      if (/<DetailPageSkeleton\b/.test(line)) report(rel, i + 1, 'DetailPageSkeleton (a whole-page skeleton)');
    });
  }

  // ONE SWITCH, over app/ and components/.
  const foreign = foreignSkeletonRenders(
    new Map([...tree].filter(([full]) => inTrees(full, ['app', 'components']))),
    libTree,
  );
  violations.push(...foreign.violations);

  // A skeleton the installed lib marks `@deprecated` is never used: its replacement is the component in a scope.
  const deprecated = deprecatedLibSkeletons(libTree);
  const deprecatedUse = deprecated.size ? new RegExp(`<(${[...deprecated].join('|')})\\b`, 'g') : null;

  for (const [full, { rel, source, lines }] of tree) {
    const example = rel.startsWith(join('components', 'examples'));
    if (deprecatedUse && inTrees(full, ['app', 'components'])) {
      for (const m of source.matchAll(deprecatedUse)) {
        report(
          rel,
          lineOf(source, m.index),
          `<${m[1]}> is deprecated in the lib (render the component in a loading scope)`,
        );
      }
    }
    for (const m of source.matchAll(MEMORY))
      report(rel, lineOf(source, m.index), `${m[0]} (the removed first-paint memory)`);
    for (const m of source.matchAll(/<StreamedPage\b[\s\S]*?\/>/g)) {
      for (const prop of m[0].matchAll(/\b(skeleton|memory|remember)=/g)) {
        report(rel, lineOf(source, m.index + prop.index), `StreamedPage \`${prop[1]}\` (it takes a placeholder)`);
      }
    }
    for (const m of source.matchAll(
      /\b(standIn|isStandIn|STAND_IN_MARK|HoldStandIn|HoldText|HoldWords|HoldBox|useHolds|HELD_CONTROL_CLASS)\b|<Hold\b/g,
    )) {
      report(rel, lineOf(source, m.index), `${m[0]} (stand-in data is retired: draw the component's skeleton)`);
    }
    if (example) continue;
    lines.forEach((line, i) => {
      if (isComment(line) || optedOut(lines, i, OPT_OUT)) return;
      for (const [pattern, why] of STANDARD) if (pattern.test(line)) report(rel, i + 1, why);
    });
    // "Loading…" text split over JSX lines (`>\n  Loading thread…\n<`).
    for (const m of source.matchAll(/>\s*\n\s*(Loading|Checking)\b[^<{]*(\.\.\.|…)\s*\n?\s*</g)) {
      const line = lineOf(source, m.index);
      if (!optedOut(lines, line + 1, OPT_OUT))
        report(rel, line, '"Loading…" text as a loading state (draw the component skeleton)');
    }
    // A Suspense with no fallback draws nothing while it waits.
    for (const m of source.matchAll(SUSPENSE_TAG)) {
      const line = lineOf(source, m.index);
      if (!/\bfallback\s*=/.test(m[1]) && !isComment(lines[line - 1]) && !optedOut(lines, line - 1, OPT_OUT))
        report(rel, line, 'a Suspense with no fallback (use LoadingSuspense / LoadingFallback)');
    }
    // Nothing drawn while a read is pending: `if (!data) return null` in a function that has not answered its read yet
    // (no loading branch, no scope switch and no suspending read above it in the same function).
    for (const m of full.endsWith('.tsx') ? source.matchAll(NULL_WHEN_MISSING) : []) {
      const line = lineOf(source, m.index);
      if (optedOut(lines, line - 1, OPT_OUT)) continue;
      const owner = enclosingDeclaration(source, m.index);
      // A component (capitalised), not a callback or a hook.
      if (!/^[A-Z]/.test(owner)) continue;
      const declarations = [
        ...source.slice(0, m.index).matchAll(new RegExp(`\\b(?:function|const)\\s+${owner}\\b`, 'g')),
      ];
      const ownerAt = declarations.at(-1)?.index ?? 0;
      if (
        !READ_ANSWERED.test(source.slice(ownerAt, m.index)) &&
        /\b(?:data|isLoading|loading|isFetching)\b/.test(source.slice(ownerAt, m.index))
      ) {
        report(rel, line, 'nothing drawn while the read is pending (draw the component in a loading scope)');
      }
    }
    // A component that switches only on its prop draws its skeleton outside every loading scope: a screen in a scope
    // gets the loaded form with no data. One switch: `useLoadingScope() || loading`.
    if (!/\buseLoadingScope\s*\(/.test(source)) {
      for (const m of source.matchAll(PROP_SWITCH)) {
        const line = lineOf(source, m.index);
        if (!optedOut(lines, line - 1, OPT_OUT))
          report(rel, line, 'a switch on the loading prop alone (switch on useLoadingScope() || loading)');
      }
    }
  }

  // Page code: no skeleton primitive, no route `loading.tsx`, no component skeleton rendered (a Suspense `fallback=`
  // included: the component switches itself; a fallback is the same component in a loading scope).
  const pageCode = full => {
    const rel = relative(base, full);
    if (inTrees(full, ['lib'])) return full.endsWith('.tsx');
    if (inTrees(full, ['app'])) return full.endsWith('.tsx') && isPageFile(rel, base);
    if (inTrees(full, ['components'])) return SCREEN_FILE.test(basename(full));
    return false;
  };
  for (const [full, { rel, source, lines }] of tree) {
    if (!pageCode(full)) continue;
    if (basename(full) === 'loading.tsx') report(rel, 0, 'a route-level loading.tsx');
    lines.forEach((line, i) => {
      if (isComment(line)) return;
      for (const [pattern, why] of PRIMITIVES) if (pattern.test(line)) report(rel, i + 1, why);
    });
    if (inTrees(full, ['lib'])) continue;
    const dynamicSpans = dynamicLoadingSpans(source);
    for (const m of source.matchAll(/<([A-Z][A-Za-z0-9.]*Skeleton)\b/g)) {
      if (dynamicSpans.some(([start, end]) => m.index > start && m.index < end)) continue;
      const line = lineOf(source, m.index);
      if (optedOut(lines, line - 1, OPT_OUT)) continue;
      report(rel, line, `<${m[1]}> rendered by page code (render the component: it draws its own skeleton)`);
    }
  }
  return { violations, warnings: foreign.warnings };
}

export function pageSkeletonViolations(base = root) {
  return pageSkeletonReport(base).violations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Unlike the hub, where they are a follow-up warning, a parent choosing a child's skeleton FAILS here: the frontend
  // converted every one (CU-17tkuw5z69a), so a new one is a regression.
  const { violations, warnings } = pageSkeletonReport();
  const all = [...violations, ...warnings];
  if (all.length > 0) {
    console.error(
      `check-page-skeletons: ${all.length} place(s) that break the loading standard. A screen's loading state is the ` +
        'screen itself in a loading scope (LoadingWhen / LoadingFallback from the lib) where every component draws its own skeleton.',
    );
    for (const v of all) console.error(`  ${v}`);
    process.exit(1);
  }
  console.log('check-page-skeletons: OK (no screen draws a skeleton)');
}
