/**
 * What both loading gates (`check-page-skeletons.mjs`, `check-skeleton-full-page.mjs`) read the source with: one walk,
 * one notion of a declaration, one opt-out and one way to resolve where a rendered component lives.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const SKIPPED_DIRS = new Set(['node_modules', '__tests__']);
const TEST_FILE = /\.(test|stories)\.tsx?$/;

/** Every `.tsx` (and, with `ts`, `.ts`) file under `dir`, skipping dependencies, dot folders and tests. */
export function* walkFiles(dir, { ts = false, tests = false } = {}) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIPPED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full, { ts, tests });
      continue;
    }
    if (!tests && TEST_FILE.test(entry.name)) continue;
    if (entry.name.endsWith('.tsx') || (ts && entry.name.endsWith('.ts'))) yield full;
  }
}

/** The name of the nearest top-level declaration (`function X`, `const X =`, `class X`) above `index`, or ''. */
export function enclosingDeclaration(source, index) {
  const declarations = [
    ...source
      .slice(0, index)
      .matchAll(
        /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s*\*?\s*|const\s+|let\s+|class\s+)([A-Za-z_$][\w$]*)/gm,
      ),
  ];
  return declarations.at(-1)?.[1] ?? '';
}

/** Component name -> the files that declare it (`function X`, `const X`, `class X`). */
export function declarationIndex(sources) {
  const index = new Map();
  for (const [file, source] of sources) {
    for (const m of source.matchAll(/\b(?:function|const|class)\s+([A-Z][A-Za-z0-9]*)\b/g)) {
      if (!index.has(m[1])) index.set(m[1], new Set());
      index.get(m[1]).add(file);
    }
  }
  return index;
}

/** Whether a line is a comment line. */
export function isComment(line) {
  return /^\s*(\/\/|\*|\/\*)/.test(line);
}

/** Whether line `i` (0-based) opts out with `// <marker> <why>` on it or on one of the two lines above. */
export function optedOut(lines, i, marker) {
  return lines.slice(Math.max(0, i - 2), i + 1).some(line => line.includes(marker));
}

/** 1-based line of a character index. */
export function lineOf(source, index) {
  return source.slice(0, index).split('\n').length;
}

/**
 * The `loading: () => …` arrows that are a `next/dynamic` call's own fallback (the line from the arrow to its end),
 * never a `loading:` key of any other object.
 */
export function dynamicLoadingSpans(source) {
  const spans = [];
  for (const m of source.matchAll(/\bloading:\s*\(\)\s*=>/g)) {
    // The last `dynamic(` (or `dynamic<Props>(`) call opened before the arrow.
    const calls = [...source.slice(0, m.index).matchAll(/\bdynamic\s*(?:<[^>]*>)?\s*\(/g)];
    const call = calls.at(-1);
    if (!call) continue;
    // Still inside that call: more `(` than `)` between the call's own `(` and the arrow.
    const between = source.slice(call.index + call[0].length - 1, m.index);
    const depth = (between.match(/\(/g) ?? []).length - (between.match(/\)/g) ?? []).length;
    if (depth <= 0) continue;
    const end = source.indexOf('\n', m.index);
    spans.push([m.index, end === -1 ? source.length : end]);
  }
  return spans;
}

/** The file a component name rendered in `file` is imported from (relative or `@/` paths), or null. */
export function importedFrom(file, source, name, srcRoot) {
  for (const m of source.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const names = m[1].split(',').map(part =>
      part
        .trim()
        .split(/\s+as\s+/)
        .pop(),
    );
    if (!names.includes(name)) continue;
    const spec = m[2];
    const base = spec.startsWith('@/')
      ? join(srcRoot, spec.slice(2))
      : spec.startsWith('.')
        ? resolve(dirname(file), spec)
        : null;
    if (!base) return null;
    for (const candidate of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    return null;
  }
  return null;
}

/** Read every file of `walkFiles` into a Map (path -> source). */
export function readSources(dirs, options) {
  const sources = new Map();
  for (const dir of dirs) for (const file of walkFiles(dir, options)) sources.set(file, readFileSync(file, 'utf8'));
  return sources;
}
