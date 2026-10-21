#!/usr/bin/env node
/**
 * Full-page skeleton gate (`npm run check:loading`). Ported from the hub's `scripts/check-skeleton-full-page.mjs`.
 *
 * A paged list's loading skeleton draws its whole page size, and a list fetched with a limit draws that limit, at
 * every width (owner decision, 2026-10-21; the hub's CLAUDE.md "Loading states"). MLG's leaderboard drew 8 rows of a 15-row
 * page because its count was `Math.min(pageSize, MLG_ROW_FOLD.desktop)`: a page size capped by a screen's fold.
 *
 * Four rules, each failing a line (a line, or the line under it, may opt out with `// full-page-ok: <why>`):
 *
 * 1. FOLD: no `Math.min(…)` whose arguments name a page size or a limit (`pageSize`, `perPage`, `PAGE_SIZE`, `limit`,
 *    `LIMIT`, `cardsPerPage`, `_MAX`) together with a fold (`FOLD`, `fold`, `SCREEN`). A list with no page size and no
 *    limit keeps a typical count and is not affected.
 * 2. TYPED COUNT: a list skeleton's count names where it comes from. A literal number in `skeletonRows={…}`,
 *    `skeletonCount={…}`, `rows={…}` on a `*Skeleton` element, or a literal-length list (`Array.from({ length: N })`,
 *    `Array(N)`, `[0, 1, 2].map`) inside a `*Skeleton` function or on a line that reads a loading flag
 *    (`loading`, `isLoading`, `useLoadingScope`), fails.
 * 3. COUNT SOURCE: `skeletonRows={x}` / `skeletonCount={x}` names a page size, a limit, a `*_SKELETON_*` typical
 *    constant, `first` (a connection's page) or `pageSize`. Any other name hides where the count comes from.
 * 4. ITEM MARK: a skeleton list drawn from a page size, a limit or a `*_SKELETON_*` constant marks each item
 *    (`data-loading-item`, or the `listItem` prop that sets it) within the next lines, so the runtime gate counts it
 *    like the loaded list. The mark may sit inside the item's component (found by name across `src/`), or, for a list
 *    built into a variable and rendered later, anywhere in the file.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TREES = ['app', 'components', 'hooks', 'lib'];
const PAGE = /\b(page_?size|per_?page|cards_?per_?page|limit|[A-Z_]*_(PAGE_SIZE|LIMIT|MAX))\b/i;
const FOLD = /fold|screen/i;
const MIN_CALL = /Math\.min\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
const TYPED_PROP = /\b(skeletonRows|skeletonCount)=\{\s*\d+\s*\}/;
const TYPED_ROWS_ON_SKELETON = /<[A-Z]\w*Skeleton\b[^>]*\brows=\{\s*\d+\s*\}/;
const TYPED_LENGTH = /Array\.from\(\{\s*length:\s*\d+\s*\}|\bArray\(\s*\d+\s*\)|\[\s*\d+\s*(?:,\s*\d+\s*)+\]\s*\.map\(/;
const LOADING_FLAG = /\b(isLoading|loading|useLoadingScope)\b/;
const COUNT_PROP = /\b(skeletonRows|skeletonCount)=\{\s*([A-Za-z_$][\w$.]*)\s*\}/g;
const COUNT_SOURCE = /(PAGE_SIZE|LIMIT|_SKELETON_|^first$|\.first$|pageSize|page_size|limit$)/;
const LIST_FROM_COUNT = /Array\.from\(\{\s*length:\s*([A-Za-z_$][\w$.]*)\s*\}/;
const LIST_COUNT_NAME = /(PAGE_SIZE|LIMIT|_SKELETON_)/;
const ITEM_MARK = /data-loading-item|\blistItems?\b/;
const MARK_WINDOW = 12;

/** The name of the nearest enclosing `function X` / `const X =` declaration above `index`. */
function enclosing(source, index) {
  const before = source.slice(0, index);
  const all = [
    ...before.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:function\s+|const\s+)([A-Za-z_$][\w$]*)/g),
  ];
  return all.at(-1)?.[1] ?? '';
}

function* walk(root, dir) {
  if (!existsSync(join(root, dir))) return;
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === '__tests__') continue;
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(root, rel);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) yield rel;
  }
}

/** Component name -> whether the file declaring it marks its items. Built from every file under `src/`. */
export function markIndex(sources) {
  const index = new Map();
  for (const source of sources) {
    const marks = ITEM_MARK.test(source);
    for (const m of source.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:function\s+|const\s+)([A-Z][\w$]*)/g)) {
      index.set(m[1], (index.get(m[1]) ?? false) || marks);
    }
  }
  return index;
}

/** Whether a skeleton list starting at line `i` marks its items. */
function listMarked(lines, i, source, marks) {
  const window = lines.slice(i, i + MARK_WINDOW).join('\n');
  if (ITEM_MARK.test(window)) return true;
  const element = window.match(/<([A-Z][\w$]*)/);
  if (element && marks.get(element[1])) return true;
  // Built into a variable (`const rows = loading ? Array.from(…) : …`) and rendered further down.
  const assigned = lines.slice(Math.max(0, i - 2), i + 1).some(l => /\b(const|let)\s+\w+[^=]*=/.test(l));
  return assigned && ITEM_MARK.test(source);
}

/** The problems of one file's source, as `file:line — why` strings. */
export function fullPageProblems(file, source, marks = new Map()) {
  const problems = [];
  const lines = source.split('\n');
  let offset = 0;
  lines.forEach((line, i) => {
    const at = offset;
    offset += line.length + 1;
    if (line.includes('full-page-ok:') || (i > 0 && lines[i - 1].includes('full-page-ok:'))) return;
    const where = `${file}:${i + 1}`;
    if (TYPED_PROP.test(line) || TYPED_ROWS_ON_SKELETON.test(line)) {
      problems.push(`${where} — a typed skeleton count; name the list's page size, limit or a *_SKELETON_* constant`);
    }
    const owner = enclosing(source, at);
    if (TYPED_LENGTH.test(line) && (/Skeleton$/.test(owner) || LOADING_FLAG.test(line))) {
      problems.push(
        `${where} — a typed count in ${owner || 'a loading branch'}; name the list's page size, limit or a *_SKELETON_* constant`,
      );
    }
    for (const m of line.matchAll(COUNT_PROP)) {
      // A pass-through (`skeletonRows={skeletonRows}`) is checked where its caller names the count.
      if (m[1] !== m[2] && !COUNT_SOURCE.test(m[2])) {
        problems.push(
          `${where} — ${m[1]}={${m[2]}} does not name a page size, a limit or a *_SKELETON_* constant; name where the count comes from`,
        );
      }
    }
    const list = line.match(LIST_FROM_COUNT);
    if (list && LIST_COUNT_NAME.test(list[1])) {
      if (!listMarked(lines, i, source, marks)) {
        problems.push(
          `${where} — a skeleton list of ${list[1]} items with no data-loading-item (or listItem) on its items`,
        );
      }
    }
    for (const m of line.matchAll(MIN_CALL)) {
      if (PAGE.test(m[1]) && FOLD.test(m[1])) {
        problems.push(
          `${where} — a page size or limit capped by a fold (\`${m[0]}\`); a list's skeleton draws its full page`,
        );
      }
    }
  });
  return problems;
}

/** Every problem under `root` (the app's `src/`), and how many files were read. */
export function fullPageReport(root) {
  const sources = new Map();
  for (const tree of TREES) {
    for (const file of walk(root, tree)) sources.set(file, readFileSync(join(root, file), 'utf8'));
  }
  const marks = markIndex(sources.values());
  const problems = [];
  for (const [file, source] of sources) problems.push(...fullPageProblems(file, source, marks));
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
