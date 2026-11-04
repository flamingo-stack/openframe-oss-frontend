/** The pre-paint width seed: the persisted collapse, the width the user chose, and the Mingo-first default on a SaaS tenant. */

import { afterEach, describe, expect, it } from 'vitest';
import { sidebarWidthFoucScript } from './navigation-sidebar-state';

const WIDTH_VAR = '--of-navigation-sidebar-width';
const CHOSEN_KEY = 'of.navigationSidebar.width:chosen';

function seed({
  grouped,
  minimized = false,
  chosen,
}: {
  grouped: boolean;
  minimized?: boolean;
  /** The raw stored entry, as the core sidebar (or anything else) left it. */
  chosen?: string;
}): string {
  if (minimized) window.localStorage.setItem('of.navigationSidebar.minimized', 'true');
  if (chosen !== undefined) window.localStorage.setItem(CHOSEN_KEY, chosen);
  // The script is ours, built from constants: what runs in `<head>` runs here.
  new Function(sidebarWidthFoucScript(grouped))();
  return document.documentElement.style.getPropertyValue(WIDTH_VAR);
}

describe('sidebarWidthFoucScript', () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.style.removeProperty(WIDTH_VAR);
  });

  it('seeds the Mingo-first width for the grouped sidebar, the classic one otherwise', () => {
    expect(seed({ grouped: true })).toBe('264px');
    expect(seed({ grouped: false })).toBe('224px');
  });

  it('seeds the rail for a collapsed sidebar either way', () => {
    expect(seed({ grouped: true, minimized: true })).toBe('56px');
    expect(seed({ grouped: false, minimized: true })).toBe('56px');
  });

  it('seeds the width the user chose, in both shells', () => {
    expect(seed({ grouped: true, chosen: JSON.stringify({ size: 400 }) })).toBe('400px');
    expect(seed({ grouped: false, chosen: JSON.stringify({ size: 400 }) })).toBe('400px');
    expect(seed({ grouped: true, chosen: JSON.stringify({ size: 333.6 }) })).toBe('334px');
  });

  it('keeps the chosen width within the bounds the sidebar has', () => {
    expect(seed({ grouped: true, chosen: JSON.stringify({ size: 900 }) })).toBe('480px');
    expect(seed({ grouped: true, chosen: JSON.stringify({ size: 100 }) })).toBe('200px');
  });

  it('the rail wins over a chosen width', () => {
    expect(seed({ grouped: true, minimized: true, chosen: JSON.stringify({ size: 400 }) })).toBe('56px');
  });

  it('ignores an entry that is not a size, and still seeds the collapse', () => {
    expect(seed({ grouped: true, chosen: 'not json' })).toBe('264px');
    expect(seed({ grouped: true, chosen: JSON.stringify({ size: '400' }) })).toBe('264px');
    expect(seed({ grouped: true, chosen: JSON.stringify(400) })).toBe('264px');
    expect(seed({ grouped: false, minimized: true, chosen: 'not json' })).toBe('56px');
  });
});
