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
 *     progress icon (`Loader2`, `RefreshCw`), never a hand-made spinner.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, basename } from 'node:path';

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

function* files(dir, withTs = false) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === '__tests__') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full, withTs);
    else if (entry.name.endsWith('.tsx') || (withTs && entry.name.endsWith('.ts'))) yield full;
  }
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

/** The name of the top-level declaration (`function X`, `const X =`, `class X`) that encloses `index`. */
function enclosingDeclaration(source, index) {
  const before = source.slice(0, index);
  const declarations = [
    ...before.matchAll(
      /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s*|const\s+|let\s+|class\s+)([A-Za-z_$][A-Za-z0-9_$]*)/gm,
    ),
  ];
  return declarations.at(-1)?.[1] ?? null;
}

/**
 * ONE SWITCH, PER COMPONENT (see the header): `<XSkeleton />` rendered outside X's own module and outside a
 * `*Skeleton` function, when X's module switches itself (calls `useLoadingScope`).
 */
function foreignSkeletonRenders(roots, indexRoots = []) {
  const violations = [];
  const warnings = [];
  const sources = new Map();
  for (const { dir, label } of roots) {
    for (const full of files(dir, true)) {
      if (/\.(test|stories)\.tsx?$/.test(full)) continue;
      sources.set(full, { rel: label + relative(dir, full), source: readFileSync(full, 'utf8') });
    }
  }
  // The installed lib's source is INDEXED (where each lib component is declared, and whether it switches itself)
  // but never reported on: the lib gates its own code. So a frontend parent picking `<ModelDisplaySkeleton>` for
  // a lib `ModelDisplay` that switches on the scope fails here like any frontend component would.
  const indexOnly = new Set();
  for (const { dir, label } of indexRoots) {
    for (const full of files(dir, true)) {
      if (/\.(test|stories)\.tsx?$/.test(full)) continue;
      sources.set(full, { rel: label + relative(dir, full), source: readFileSync(full, 'utf8') });
      indexOnly.add(full);
    }
  }
  // Where each component is declared, and whether that module switches itself.
  const declaredIn = new Map();
  for (const [full, { source }] of sources) {
    for (const m of source.matchAll(/\b(?:function|const|class)\s+([A-Z][A-Za-z0-9]*)\b/g)) {
      if (!declaredIn.has(m[1])) declaredIn.set(m[1], new Set());
      declaredIn.get(m[1]).add(full);
    }
  }
  const switches = full => /\buseLoadingScope\s*\(/.test(sources.get(full)?.source ?? '');
  for (const [full, { rel, source }] of sources) {
    if (indexOnly.has(full)) continue;
    const lines = source.split('\n');
    const dynamicSpans = [];
    for (const m of source.matchAll(/\bloading:\s*\(\)\s*=>/g)) {
      const end = source.indexOf('\n', m.index);
      dynamicSpans.push([m.index, end === -1 ? source.length : end]);
    }
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
      const switched = modules.some(switches);
      if (dynamicSpans.some(([start, end]) => m.index > start && m.index < end)) continue;
      const enclosing = enclosingDeclaration(source, m.index) ?? '';
      const line = source.slice(0, m.index).split('\n').length;
      if (/Skeleton$/.test(enclosing)) {
        // A parent's own skeleton may compose a child's, UNLESS the parent itself renders `<Child />` (in this module)
        // and the child switches itself: the parent's skeleton then renders `<Child />` too (see the header).
        const parent = enclosing.replace(/Skeleton$/, '');
        const parentRendersChild = [...source.matchAll(new RegExp(`<${component}(?=[\\s/>])`, 'g'))].some(
          r => enclosingDeclaration(source, r.index) === parent,
        );
        if (!(parentRendersChild && switched)) continue;
        if (/loading-standard-ok:/.test(lines.slice(Math.max(0, line - 2), line).join('\n'))) continue;
        warnings.push(
          `${rel}:${line}: <${component}Skeleton> rendered by ${enclosing}, while ${parent} renders <${component} />, which switches itself (render <${component} /> in ${enclosing} too: one switch per component)`,
        );
        continue;
      }
      if (/^\s*(\/\/|\*|\/\*)/.test(lines[line - 1])) continue;
      if (/loading-standard-ok:/.test(lines.slice(Math.max(0, line - 2), line).join('\n'))) continue;
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

/** What breaks the standard (`violations`, exit 1) and what is reported only (`warnings`: NO SCOPE SWITCH). */
export function pageSkeletonReport(base = root) {
  const violations = [];
  const wholeViewRoots = ['app', 'components', 'lib'].map(dir => ({ dir: join(base, dir), label: `${dir}/` }));
  for (const { dir, label } of wholeViewRoots) {
    for (const full of files(dir)) {
      if (/\.(test|stories)\.tsx$/.test(full)) continue;
      const rel = label + relative(dir, full);
      const fileLines = readFileSync(full, 'utf8').split('\n');
      fileLines.forEach((line, index) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        // The same documented exception the ONE SWITCH check honors: a marker on one of the two lines above.
        if (/loading-standard-ok:/.test(fileLines.slice(Math.max(0, index - 2), index).join('\n'))) return;
        const match = SCREEN_SKELETON.exec(line);
        if (match) violations.push(`${rel}:${index + 1}: ${match[1]} (a whole-view skeleton)`);
        if (/<DetailPageSkeleton\b/.test(line))
          violations.push(`${rel}:${index + 1}: DetailPageSkeleton (a whole-page skeleton)`);
      });
    }
  }
  // The installed lib's source (see foreignSkeletonRenders): `node_modules` beside `src/`.
  const installedLib = join(base, '..', 'node_modules', '@flamingo-stack', 'openframe-frontend-core', 'src');
  const foreign = foreignSkeletonRenders(
    [
      { dir: join(base, 'app'), label: 'app/' },
      { dir: join(base, 'components'), label: 'components/' },
    ],
    existsSync(installedLib) ? [{ dir: installedLib, label: 'lib/' }] : [],
  );
  violations.push(...foreign.violations);
  for (const dir of ['app', 'components', 'lib', 'hooks']) {
    for (const full of files(join(base, dir), true)) {
      const rel = relative(base, full);
      const source = readFileSync(full, 'utf8');
      const lineOf = index => source.slice(0, index).split('\n').length;
      for (const m of source.matchAll(MEMORY))
        violations.push(`${rel}:${lineOf(m.index)}: ${m[0]} (the removed first-paint memory)`);
      for (const m of source.matchAll(/<StreamedPage\b[\s\S]*?\/>/g)) {
        for (const prop of m[0].matchAll(/\b(skeleton|memory|remember)=/g)) {
          violations.push(
            `${rel}:${lineOf(m.index + prop.index)}: StreamedPage \`${prop[1]}\` (it takes a placeholder)`,
          );
        }
      }
      for (const m of source.matchAll(
        /\b(standIn|isStandIn|STAND_IN_MARK|HoldStandIn|HoldText|HoldWords|HoldBox|useHolds|HELD_CONTROL_CLASS)\b|<Hold\b/g,
      )) {
        violations.push(`${rel}:${lineOf(m.index)}: ${m[0]} (stand-in data is retired: draw the component's skeleton)`);
      }
    }
  }
  // The rest of the standard, mechanically (anywhere in `src/`; a line may opt out with `// loading-standard-ok: <why>`):
  //   - a text bar is `TextLineSkeleton`, never a `UnifiedSkeleton` sized in `lh`;
  //   - one pulse: no `animate-pulse`, hand-set animation timing or `bg-ods-skeleton` outside the lib's skeleton components;
  //   - a loading state is a skeleton: never "Loading…" text, and never a `Suspense` fallback of `null` or of text.
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
      />\s*(Loading|Checking)\b[^<{]*(\.\.\.|\u2026)\s*<|['"`](Loading|Checking)\b[^'"`]*(\.\.\.|\u2026)['"`]/,
      '"Loading…" text as a loading state (draw the component skeleton)',
    ],
  ];
  for (const dir of ['app', 'components', 'lib', 'hooks']) {
    for (const full of files(join(base, dir), true)) {
      const rel = relative(base, full);
      if (rel.startsWith(join('components', 'examples'))) continue;
      readFileSync(full, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(line) || /loading-standard-ok:/.test(line)) return;
          for (const [pattern, name] of STANDARD)
            if (pattern.test(line)) violations.push(`${rel}:${index + 1}: ${name}`);
        });
    }
  }
  // "Loading…" text split over JSX lines (`>\n  Loading thread…\n<`) (the lib
  // has its own one-pulse test; this keeps loading TEXT out of both).
  const MULTILINE_LOADING = />\s*\n\s*(Loading|Checking)\b[^<{]*(\.\.\.|\u2026)\s*\n?\s*</g;
  const scan = (dir, label, patterns) => {
    for (const full of files(dir, true)) {
      const rel = label + relative(dir, full);
      if (/\.(test|stories)\.tsx?$/.test(full)) continue;
      const source = readFileSync(full, 'utf8');
      const lines = source.split('\n');
      for (const pattern of patterns) {
        for (const m of source.matchAll(pattern)) {
          const line = source.slice(0, m.index).split('\n').length;
          const text = lines.slice(line - 1, line + 2).join('\n');
          if (/loading-standard-ok:/.test(text)) continue;
          violations.push(`${rel}:${line}: "Loading…" text as a loading state (draw the component skeleton)`);
        }
      }
    }
  };
  for (const dir of ['app', 'components', 'lib', 'hooks']) scan(join(base, dir), `${dir}/`, [MULTILINE_LOADING]);
  const check = full => {
    const rel = relative(base, full);
    if (basename(full) === 'loading.tsx') violations.push(`${rel}: a route-level loading.tsx`);
    const source = readFileSync(full, 'utf8');
    source.split('\n').forEach((line, index) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      for (const [pattern, name] of PRIMITIVES) {
        if (pattern.test(line)) violations.push(`${rel}:${index + 1}: ${name}`);
      }
    });
  };
  // Page code renders no component skeleton, a Suspense `fallback=` included (the component switches itself; a
  // fallback is the same component in a loading scope).
  const renderedSkeletons = full => {
    const rel = relative(base, full);
    const source = readFileSync(full, 'utf8');
    const lines = source.split('\n');
    // `next/dynamic`'s `loading: () => …` is the fallback while a component's code loads (one line): exempt.
    const dynamicSpans = [];
    for (const m of source.matchAll(/\bloading:\s*\(\)\s*=>/g)) {
      const end = source.indexOf('\n', m.index);
      dynamicSpans.push([m.index, end === -1 ? source.length : end]);
    }
    for (const m of source.matchAll(/<([A-Z][A-Za-z0-9.]*Skeleton)\b/g)) {
      if (dynamicSpans.some(([start, end]) => m.index > start && m.index < end)) continue;
      const line = source.slice(0, m.index).split('\n').length;
      const text = lines.slice(Math.max(0, line - 2), line).join('\n');
      if (/loading-standard-ok:/.test(text)) continue;
      violations.push(
        `${rel}:${line}: <${m[1]}> rendered by page code (render the component: it draws its own skeleton)`,
      );
    }
  };
  for (const full of files(join(base, 'app'))) {
    if (!isPageFile(relative(base, full), base)) continue;
    check(full);
    renderedSkeletons(full);
  }
  // A screen under `components/` is page code too (see the header).
  for (const full of files(join(base, 'components'))) {
    if (!SCREEN_FILE.test(basename(full))) continue;
    check(full);
    renderedSkeletons(full);
  }
  for (const full of files(join(base, 'lib'))) check(full);
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
