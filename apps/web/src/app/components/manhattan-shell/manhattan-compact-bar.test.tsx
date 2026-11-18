/**
 * The compact top bar: shown by the stylesheet in the compact band until the window is read,
 * from md up once the shell knows the form is compact.
 */

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ManhattanCompactBar } from './manhattan-compact-bar';
import { COMPACT_BAND_FLEX } from './use-manhattan-squeeze';

function barClasses(bandOnly: boolean): string[] {
  const container = document.createElement('div');
  container.innerHTML = renderToString(
    <ManhattanCompactBar onOpenChats={() => {}} onOpenNavigation={() => {}} bandOnly={bandOnly} />,
  );
  return (container.firstElementChild?.getAttribute('class') ?? '').split(/\s+/);
}

describe('ManhattanCompactBar', () => {
  it('is in the server markup shown only in the compact band before the window is read', () => {
    const classes = barClasses(true);
    expect(classes).toContain('hidden');
    expect(classes).toContain(COMPACT_BAND_FLEX);
    expect(classes).not.toContain('md:flex');
  });

  it('shows from md up once the window is read as compact', () => {
    const classes = barClasses(false);
    expect(classes).toContain('md:flex');
    expect(classes).not.toContain(COMPACT_BAND_FLEX);
  });
});
