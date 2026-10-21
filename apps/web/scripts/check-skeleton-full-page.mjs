#!/usr/bin/env node
/**
 * Full-page skeleton gate (`npm run check:loading`). Ported from the hub's `scripts/check-skeleton-full-page.mjs`.
 *
 * A paged list's loading skeleton draws its whole page size, and a list fetched with a limit draws that limit, at
 * every width (owner decision, 2026-10-21; the hub's CLAUDE.md "Loading states"). MLG's leaderboard drew 8 rows of a 15-row
 * page because its count was `Math.min(pageSize, MLG_ROW_FOLD.desktop)`: a page size capped by a screen's fold.
 *
 * THE predicate: no file under `src/` caps a page size or a limit with a fold. A `Math.min(…)` whose arguments name a page
 * size or a limit (`pageSize`, `perPage`, `PAGE_SIZE`, `limit`, `LIMIT`, `cardsPerPage`, `_MAX`) together with a
 * fold (`FOLD`, `fold`, `SCREEN`) fails. A list with no page size and no limit keeps a typical count and is not
 * affected. A line may opt out with `// full-page-ok: <why>`.
 *
 * AND no typed count (frontend addition, CU-17tkuw5z69a): a list skeleton's count names where it comes from. A literal
 * number in `skeletonRows={…}`, `skeletonCount={…}`, `rows={…}` on a `*Skeleton` element, or `Array.from({ length: … })`
 * inside a function named `*Skeleton`, fails: the count is the list's page-size or limit constant (`*PAGE_SIZE`,
 * `*LIMIT`), or, for a list with neither, a declared typical constant (`*_SKELETON_*`). A field set that is fixed by
 * design (the four rows a card always shows) declares its constant too, so the reason is written once.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..', 'src');
const TREES = ['app', 'components', 'hooks', 'lib'];
const PAGE = /\b(page_?size|per_?page|cards_?per_?page|limit|[A-Z_]*_(PAGE_SIZE|LIMIT|MAX))\b/i;
const FOLD = /fold|screen/i;
const MIN_CALL = /Math\.min\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;
const TYPED_PROP = /\b(skeletonRows|skeletonCount)=\{\s*\d+\s*\}/;
const TYPED_ROWS_ON_SKELETON = /<[A-Z]\w*Skeleton\b[^>]*\brows=\{\s*\d+\s*\}/;
const TYPED_LENGTH = /Array\.from\(\{\s*length:\s*\d+\s*\}/;

/** The name of the nearest enclosing `function X` / `const X =` declaration above `index`. */
function enclosing(source, index) {
  const before = source.slice(0, index);
  const all = [
    ...before.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:function\s+|const\s+)([A-Za-z_$][\w$]*)/g),
  ];
  return all.at(-1)?.[1] ?? '';
}

function* walk(dir) {
  if (!existsSync(join(root, dir))) return;
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.') || entry.name === '__tests__') continue;
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(rel);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) yield rel;
  }
}

const problems = [];
let files = 0;
for (const tree of TREES) {
  for (const file of walk(tree)) {
    files++;
    const source = readFileSync(join(root, file), 'utf8');
    const lines = source.split('\n');
    let offset = 0;
    lines.forEach((line, i) => {
      const at = offset;
      offset += line.length + 1;
      if (line.includes('full-page-ok:') || (i > 0 && lines[i - 1].includes('full-page-ok:'))) return;
      if (TYPED_PROP.test(line) || TYPED_ROWS_ON_SKELETON.test(line)) {
        problems.push(
          `${file}:${i + 1} — a typed skeleton count; name the list's page size, limit or a *_SKELETON_* constant`,
        );
      }
      if (TYPED_LENGTH.test(line) && /Skeleton$/.test(enclosing(source, at))) {
        problems.push(
          `${file}:${i + 1} — a typed count in ${enclosing(source, at)}; name the list's page size, limit or a *_SKELETON_* constant`,
        );
      }
      for (const m of line.matchAll(MIN_CALL)) {
        if (PAGE.test(m[1]) && FOLD.test(m[1])) {
          problems.push(
            `${file}:${i + 1} — a page size or limit capped by a fold (\`${m[0]}\`); a list's skeleton draws its full page`,
          );
        }
      }
    });
  }
}

if (problems.length) {
  console.error(`check-skeleton-full-page: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error('  ' + p);
  console.error('\nSee the header of scripts/check-skeleton-full-page.mjs.');
  process.exit(1);
}
console.log(`check-skeleton-full-page: OK (${files} files)`);
