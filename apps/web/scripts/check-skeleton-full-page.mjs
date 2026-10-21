#!/usr/bin/env node
/**
 * Full-page skeleton gate (`npm run check:loading`). Ported from the hub's `scripts/check-skeleton-full-page.mjs`.
 *
 * A paged list's loading skeleton draws its whole page size, and a list fetched with a limit draws that limit, at
 * every width (owner decision, 2026-10-21; the hub's CLAUDE.md "Loading states"). MLG's leaderboard drew 8 rows of a 15-row
 * page because its count was `Math.min(pageSize, MLG_ROW_FOLD.desktop)`: a page size capped by a screen's fold.
 *
 * Six rules, each failing a line (a line, or one of the two above it, may opt out with `// full-page-ok: <why>`):
 *
 * 1. CAP: no `Math.min(…)` that caps a page size or a limit (`pageSize`, `perPage`, `PAGE_SIZE`, `limit`, `LIMIT`,
 *    `cardsPerPage`, `_MAX`) by a fold (`FOLD`, `fold`, `SCREEN`), a typed number or another CONSTANT
 *    (`MAX_VISIBLE`). `Math.min(pageSize, total)` (the last page) is fine.
 * 2. TYPED COUNT: a list skeleton's count names where it comes from. A literal number in `skeletonRows={…}`,
 *    `skeletonCount={…}`, any `skeleton…|loading…|placeholder…` `Rows|Count|Lines|Items` prop, `rows={…}` on a
 *    `*Skeleton` element, or a literal-length list (`Array.from({ length: N })`, `Array(N)`, `[0, 1, 2].map`) inside a
 *    `*Skeleton` function, on a line that reads a loading flag, or in a module-level constant a skeleton or a loading
 *    branch uses, fails.
 * 3. COUNT SOURCE: `skeletonRows={x}` / `skeletonCount={x}`, and the length of a skeleton list (`Array.from({ length:
 *    x })` in a `*Skeleton` function or a loading branch), names a page size, a limit, a `*_SKELETON_*` typical
 *    constant, `first` (a connection's page) or `pageSize` (a pass-through `skeletonRows={skeletonRows}` is checked
 *    where its caller names it). A list fetched with a SAFETY CAP rather than a page (`first: 100` so a runaway list
 *    stays bounded) is not a limited list: it draws a declared `*_SKELETON_*` typical count, stated where it is declared.
 * 4. ITEM MARK: a skeleton list drawn from a page size, a limit or a `*_SKELETON_*` constant marks each item
 *    (`data-loading-item`, or the `listItem` / `listItems` prop that sets it), and so does the loaded list beside it
 *    (a `.map(` within the same expression): the runtime gate counts both. The mark may sit inside the item's
 *    component, found through its IMPORT (or its declaration in the same file), or, for a list built into a variable
 *    and rendered later, anywhere in the file.
 * 5. OPTIONAL MARK: in a component that switches on the loading scope, a part left out while loading
 *    (`{!loading && …}`, `{!isLoading && …}`, or a part keyed on a read field, `{record?.field && <…>}`) is optional: it carries `data-loading-optional` so the runtime gate
 *    measures the loaded page without it. Not counted: an error or offline state (a failure, not a part of the record)
 *    the loaded half of an explicit pair (`{loading && <bar />}` within the twelve lines above, drawing the slot), and a
 *    ternary that chooses between two forms of one slot (`{!loading && empty ? <Empty /> : <List />}`).
 */
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enclosingDeclaration, importedFrom, optedOut, readSources } from './lib/source-scan.mjs';

const TREES = ['app', 'components', 'hooks', 'lib'];
const PAGE = /\b(page_?size|per_?page|cards_?per_?page|limit|[A-Z_]*_(PAGE_SIZE|LIMIT|MAX))\b/i;
const CAP = /fold|screen|\b[A-Z][A-Z0-9_]{2,}\b|\b\d+\b/;
const MIN_CALL = /Math\.min\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
const TYPED_PROP =
  /\b(skeletonRows|skeletonCount|(?:skeleton|loading|placeholder)\w*(?:Rows|Count|Lines|Items))=\{\s*\d+\s*\}/i;
const TYPED_ROWS_ON_SKELETON = /<[A-Z]\w*Skeleton\b[^>]*\brows=\{\s*\d+\s*\}/;
const TYPED_LENGTH = /Array\.from\(\{\s*length:\s*\d+\s*\}|\bArray\(\s*\d+\s*\)|\[\s*\d+\s*(?:,\s*\d+\s*)+\]\s*\.map\(/;
const LOADING_FLAG = /\b(isLoading|loading|useLoadingScope)\b/;
const COUNT_PROP = /\b(skeletonRows|skeletonCount)=\{\s*([A-Za-z_$][\w$.]*)\s*\}/g;
const COUNT_SOURCE = /(PAGE_SIZE|LIMIT|_SKELETON_|^first$|\.first$|pageSize|page_size|limit$)/;
const LIST_FROM_COUNT = /Array\.from\(\{\s*length:\s*([A-Za-z_$][\w$.]*)\s*\}/;
const LIST_COUNT_NAME = /(PAGE_SIZE|LIMIT|_SKELETON_|pageSize|limit)/i;
const ITEM_MARK = /data-loading-item|\blistItems?\b/;
const OPTIONAL_MARK = /data-loading-optional/;
const LEFT_OUT_WHILE_LOADING = /\{\s*!\s*(?:loading|isLoading)\s*&&|\{\s*[a-z]\w*(?:\?\.\w+)+\s*&&\s*\(?\s*</;
const SWITCHES = /\buseLoadingScope\s*\(|<LoadingWhen\b/;
const MARK_WINDOW = 12;
const LOADED_WINDOW = 15;

/** Whether the component `name`, rendered in `file`, marks its items (its import's file, else its local declaration). */
function componentMarks(name, file, source, sources, srcRoot) {
  const from = importedFrom(file, source, name, srcRoot);
  if (from) return ITEM_MARK.test(sources.get(from) ?? '');
  // Declared in this file: the mark anywhere in this file (its own JSX).
  if (new RegExp(`\\b(?:function|const|class)\\s+${name}\\b`).test(source)) return ITEM_MARK.test(source);
  return false;
}

/** Whether a list starting at line `i` marks its items. */
function listMarked(lines, i, path, source, sources, srcRoot) {
  const window = lines.slice(i, i + MARK_WINDOW).join('\n');
  if (ITEM_MARK.test(window)) return true;
  const element = window.match(/<([A-Z][\w$]*)/);
  if (element && componentMarks(element[1], path, source, sources, srcRoot)) return true;
  // Built into a variable (`const rows = loading ? Array.from(…) : …`) and rendered further down.
  const assigned = lines.slice(Math.max(0, i - 2), i + 1).some(l => /\b(const|let)\s+\w+[^=]*=/.test(l));
  return assigned && ITEM_MARK.test(source);
}

/** Module-level constants that hold a literal-length list (`const ROWS = Array.from({ length: 5 })`). */
function literalListConstants(source) {
  const names = [];
  for (const m of source.matchAll(
    /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:Array\.from\(\{\s*length:\s*\d+|Array\(\s*\d+\s*\)|\[\s*\d+\s*(?:,\s*\d+\s*)+\])/gm,
  )) {
    names.push({ name: m[1], index: m.index });
  }
  return names;
}

/**
 * The problems of one file's source, as `file:line — why` strings. `sources` (path -> source) and `srcRoot` resolve
 * the item components of rule 4; both are optional for a single-file check.
 */
export function fullPageProblems(file, source, { sources = new Map(), srcRoot = '', path = file } = {}) {
  const problems = [];
  const lines = source.split('\n');
  const switches = SWITCHES.test(source);
  const literalLists = literalListConstants(source);
  let offset = 0;
  lines.forEach((line, i) => {
    const at = offset;
    offset += line.length + 1;
    if (optedOut(lines, i, 'full-page-ok:')) return;
    const where = `${file}:${i + 1}`;
    const owner = enclosingDeclaration(source, at);

    // 2. TYPED COUNT
    if (TYPED_PROP.test(line) || TYPED_ROWS_ON_SKELETON.test(line)) {
      problems.push(`${where} — a typed skeleton count; name the list's page size, limit or a *_SKELETON_* constant`);
    }
    if (TYPED_LENGTH.test(line) && (/Skeleton$/.test(owner) || LOADING_FLAG.test(line))) {
      problems.push(
        `${where} — a typed count in ${owner || 'a loading branch'}; name the list's page size, limit or a *_SKELETON_* constant`,
      );
    }
    for (const { name, index } of literalLists) {
      if (at === index || !new RegExp(`\\b${name}\\b`).test(line)) continue;
      if (/Skeleton$/.test(owner) || LOADING_FLAG.test(line)) {
        problems.push(
          `${where} — ${name} is a literal-length list used while loading; name a page size, limit or *_SKELETON_* count`,
        );
      }
    }

    // 2b. A count laundered through another constant: a skeleton list (in a `*Skeleton` function or a loading branch)
    // whose length names neither a page size, a limit, nor a `*_SKELETON_*` constant.
    const counted = line.match(LIST_FROM_COUNT);
    if (counted && !COUNT_SOURCE.test(counted[1]) && (/Skeleton$/.test(owner) || LOADING_FLAG.test(line))) {
      problems.push(
        `${where} — a skeleton list of ${counted[1]} items; name the page size, limit or a *_SKELETON_* constant`,
      );
    }

    // 3. COUNT SOURCE
    for (const m of line.matchAll(COUNT_PROP)) {
      // A pass-through (`skeletonRows={skeletonRows}`) is checked where its caller names the count.
      if (m[1] !== m[2] && !COUNT_SOURCE.test(m[2])) {
        problems.push(
          `${where} — ${m[1]}={${m[2]}} does not name a page size, a limit or a *_SKELETON_* constant; name where the count comes from`,
        );
      }
    }

    // 4. ITEM MARK, on the skeleton list and on the loaded list beside it.
    const list = line.match(LIST_FROM_COUNT);
    if (list && LIST_COUNT_NAME.test(list[1])) {
      if (!listMarked(lines, i, path, source, sources, srcRoot)) {
        problems.push(
          `${where} — a skeleton list of ${list[1]} items with no data-loading-item (or listItem) on its items`,
        );
      }
      for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + LOADED_WINDOW); j++) {
        if (j === i || !/\.map\(/.test(lines[j]) || LIST_FROM_COUNT.test(lines[j])) continue;
        if (!listMarked(lines, j, path, source, sources, srcRoot)) {
          problems.push(
            `${file}:${j + 1} — the loaded list beside a skeleton list has no data-loading-item on its items`,
          );
        }
        break;
      }
    }

    // 5. OPTIONAL MARK
    // Not optional: an error or offline state (a failure, not a part of the record), and the loaded half of an
    // explicit pair whose loading half draws the same slot (`{loading && <bar />}` just above).
    const failureState = /\b(error|Error|isOffline|failed|Failed)\b/.test(line);
    const pairedAbove = lines.slice(Math.max(0, i - 12), i).some(l => /\{\s*(?:loading|isLoading)\s*(?:&&|\?)/.test(l));
    // A ternary (`{!loading && rows.length === 0 ? <Empty /> : <List />}`) chooses between two forms of one slot.
    const ternary = /&&[^{}]*\?\s*\(?\s*$|&&[^{}]*\?\s*</.test(line);
    if (switches && LEFT_OUT_WHILE_LOADING.test(line) && !failureState && !pairedAbove && !ternary) {
      const block = lines.slice(i, i + 4).join('\n');
      if (!OPTIONAL_MARK.test(block)) {
        problems.push(`${where} — a part left out while loading has no data-loading-optional`);
      }
    }

    // 1. CAP
    for (const m of line.matchAll(MIN_CALL)) {
      const args = m[1].split(',').map(arg => arg.trim());
      const page = args.find(arg => PAGE.test(arg));
      if (page && args.some(arg => arg !== page && CAP.test(arg))) {
        problems.push(`${where} — a page size or limit capped (\`${m[0]}\`); a list's skeleton draws its full page`);
      }
    }
  });
  return problems;
}

/** Every problem under `root` (the app's `src/`), and how many files were read. */
export function fullPageReport(root) {
  const sources = readSources(
    TREES.map(tree => join(root, tree)),
    { ts: true },
  );
  const problems = [];
  for (const [file, source] of sources) {
    problems.push(...fullPageProblems(file.slice(root.length + 1), source, { sources, srcRoot: root, path: file }));
  }
  return { problems, files: sources.size };
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
