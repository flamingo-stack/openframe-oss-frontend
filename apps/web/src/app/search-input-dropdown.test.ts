/**
 * The lib's `SearchInput` is two things: a results box (it opens its own dropdown under the field once the query is
 * two characters long) and a plain field. A screen that filters a table below the field and passes no `results` gets
 * the dropdown anyway, empty, saying "No results found" over a table that shows the match (CU-17tkuw69ecf, the
 * device's Local Accounts tab). So every `<SearchInput` in the app states which one it is: `results` for a results box,
 * `showDropdown={false}` for a plain field.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__generated__' ? [] : sourceFiles(path);
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [path] : [];
  });
}

/** The opening tag from `start` to its closing `>`, skipping any `>` inside `{…}` attribute expressions. */
function openingTag(source: string, start: number): string {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (char === '{') depth++;
    else if (char === '}') depth--;
    else if (char === '>' && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

interface SearchInputUse {
  where: string;
  tag: string;
}

function searchInputUses(): SearchInputUse[] {
  return sourceFiles(SRC).flatMap(file => {
    const source = readFileSync(file, 'utf8');
    return [...source.matchAll(/<SearchInput\b/g)].map(match => {
      const line = source.slice(0, match.index).split('\n').length;
      return { where: `${relative(SRC, file)}:${line}`, tag: openingTag(source, match.index) };
    });
  });
}

describe('SearchInput', () => {
  const uses = searchInputUses();

  it('is found where the app uses it', () => {
    expect(uses.some(use => use.where.includes('devices/components/tabs/users-tab.tsx'))).toBe(true);
  });

  it('either shows its results or turns its dropdown off', () => {
    const undeclared = uses.filter(use => !/\b(results|showDropdown)=/.test(use.tag)).map(use => use.where);
    expect(undeclared).toEqual([]);
  });
});
