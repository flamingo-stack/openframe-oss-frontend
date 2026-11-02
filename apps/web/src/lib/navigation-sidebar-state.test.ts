/** The pre-paint width seed: the persisted collapse, and the Mingo-first width on a SaaS tenant. */

import { afterEach, describe, expect, it } from 'vitest';
import { sidebarWidthFoucScript } from './navigation-sidebar-state';

const WIDTH_VAR = '--of-navigation-sidebar-width';

function seed({ grouped, minimized = false }: { grouped: boolean; minimized?: boolean }): string {
  if (minimized) window.localStorage.setItem('of.navigationSidebar.minimized', 'true');
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
});
