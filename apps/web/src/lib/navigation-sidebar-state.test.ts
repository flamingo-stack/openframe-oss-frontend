/** The pre-paint width seed: the persisted collapse, the width the user chose, and the Mingo-first default on a SaaS tenant. */

import { WORK_AREA_SHARE_CSS_VAR, workAreaShareSeedScript } from '@flamingo-stack/openframe-frontend-core/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MANHATTAN_WORK_AREA_STORAGE_KEY,
  readManhattanNavCollapsed,
  sidebarWidthFoucScript,
  writeManhattanNavCollapsed,
} from './navigation-sidebar-state';

const WIDTH_VAR = '--of-navigation-sidebar-width';
const END_WIDTH_VAR = '--of-navigation-sidebar-end-width';
const CHOSEN_KEY = 'of.navigationSidebar.width:chosen';
const JSDOM_WIDTH = window.innerWidth;

/** The window's width as the seed reads it (jsdom does no layout). */
function windowWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
}

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
    document.documentElement.style.removeProperty(END_WIDTH_VAR);
    windowWidth(JSDOM_WIDTH);
  });

  it('seeds the Manhattan v2 chats width for the grouped sidebar, the classic one otherwise', () => {
    expect(seed({ grouped: true })).toBe('280px');
    expect(seed({ grouped: false })).toBe('224px');
  });

  const endWidth = () => document.documentElement.style.getPropertyValue(END_WIDTH_VAR);

  it.each([
    [1440, '200px'],
    [1280, '200px'],
    [1279, '56px'],
    [1000, '56px'],
  ])('seeds the right navigation on a first visit by window width: %ipx -> %s', (width, expected) => {
    windowWidth(width);
    seed({ grouped: true });
    expect(endWidth()).toBe(expected);
    // The chats sidebar is open at 280px at every width.
    expect(document.documentElement.style.getPropertyValue(WIDTH_VAR)).toBe('280px');
  });

  it('seeds no right navigation in the classic shell', () => {
    seed({ grouped: false });
    expect(endWidth()).toBe('');
  });

  it("follows the user's stored choice at every width", () => {
    window.localStorage.setItem('of.manhattan.navigation.collapsed', 'true');
    windowWidth(1600);
    seed({ grouped: true });
    expect(endWidth()).toBe('56px');
    window.localStorage.setItem('of.manhattan.navigation.collapsed', 'false');
    windowWidth(1000);
    seed({ grouped: true });
    expect(endWidth()).toBe('200px');
  });

  it("ignores the old build's stored right-navigation key", () => {
    window.localStorage.setItem('of.manhattan.navigation.minimized', 'true');
    windowWidth(1440);
    seed({ grouped: true });
    expect(endWidth()).toBe('200px');
  });

  it('seeds the right navigation by width even when storage throws', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    windowWidth(1440);
    new Function(sidebarWidthFoucScript(true))();
    expect(endWidth()).toBe('200px');
    windowWidth(1000);
    new Function(sidebarWidthFoucScript(true))();
    expect(endWidth()).toBe('56px');
    getItem.mockRestore();
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
    expect(seed({ grouped: true, chosen: 'not json' })).toBe('280px');
    expect(seed({ grouped: true, chosen: JSON.stringify({ size: '400' }) })).toBe('280px');
    expect(seed({ grouped: true, chosen: JSON.stringify(400) })).toBe('280px');
    expect(seed({ grouped: false, minimized: true, chosen: 'not json' })).toBe('56px');
  });
});

describe('writeManhattanNavCollapsed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    windowWidth(JSDOM_WIDTH);
  });

  it('keeps the choice for the page when storage refuses it', () => {
    windowWidth(1440);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'QuotaExceededError');
    });
    writeManhattanNavCollapsed(true);
    expect(readManhattanNavCollapsed()).toBe(true);
    writeManhattanNavCollapsed(false);
    windowWidth(1000);
    expect(readManhattanNavCollapsed()).toBe(false);
  });
});

describe('the Manhattan divider seed (root layout)', () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.style.removeProperty(WORK_AREA_SHARE_CSS_VAR);
  });

  it('seeds the chat column share the work area stored under the Manhattan key, before paint', () => {
    window.localStorage.setItem(MANHATTAN_WORK_AREA_STORAGE_KEY, JSON.stringify({ share: 0.3 }));
    // The script is the lib's, built from constants: what runs in `<head>` runs here.
    new Function(workAreaShareSeedScript(MANHATTAN_WORK_AREA_STORAGE_KEY))();
    expect(document.documentElement.style.getPropertyValue(WORK_AREA_SHARE_CSS_VAR)).toBe('0.3');
  });

  it('seeds nothing before the divider was ever moved: the split starts in the middle', () => {
    new Function(workAreaShareSeedScript(MANHATTAN_WORK_AREA_STORAGE_KEY))();
    expect(document.documentElement.style.getPropertyValue(WORK_AREA_SHARE_CSS_VAR)).toBe('');
  });
});
