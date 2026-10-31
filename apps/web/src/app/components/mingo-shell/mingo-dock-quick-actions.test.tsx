/**
 * Mingo's quick actions over the docked composer: the quick-action set, with no caption. A
 * chip's click hands the action's instructions to the dock (`onPick`), which puts them into the
 * composer to edit and send; with no actions nothing is drawn.
 */

import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiQuickAction } from '@/app/(app)/settings/ai-settings/types/ai-settings';
import { MingoDockQuickActions } from './mingo-dock-quick-actions';

const { quickActions } = vi.hoisted(() => ({ quickActions: { value: [] as AiQuickAction[], loading: false } }));
vi.mock('@/app/(app)/mingo/hooks/use-mingo-quick-actions', () => ({
  useMingoQuickActions: () => ({ actions: quickActions.value, loading: quickActions.loading }),
}));

// The row measures how many chips fit; jsdom has no ResizeObserver (and no layout: all fit).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// The wall's marquee asks for reduced motion; jsdom has no matchMedia.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

const onPick = vi.fn<(text: string) => void>();
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  onPick.mockClear();
  quickActions.value = [];
  quickActions.loading = false;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render() {
  act(() => root.render(<MingoDockQuickActions onPick={onPick} />));
}

function chip(label: string): HTMLButtonElement {
  const row = container.querySelector('[aria-label="Quick actions"]');
  const match = Array.from(row?.querySelectorAll('button') ?? []).find(b => b.textContent?.includes(label));
  if (!match) throw new Error(`no chip "${label}"`);
  return match;
}

describe('MingoDockQuickActions', () => {
  it('hands a clicked quick action to the dock, which fills the composer', () => {
    quickActions.value = [
      { id: 'qa-1', name: 'Machines online', instructions: 'List every online machine with its customer' },
    ];
    render();
    act(() => chip('Machines online').click());
    expect(onPick).toHaveBeenCalledExactlyOnceWith('List every online machine with its customer');
  });

  it('draws the wall with no caption and no "What to ask Mingo?"', () => {
    quickActions.value = [{ id: 'qa-1', name: 'Machines online', instructions: 'List every online machine' }];
    render();
    expect(container.querySelector('h2')).toBeNull();
    expect(container.textContent).not.toContain('Quick actions');
    expect(container.textContent).not.toContain('What to ask Mingo?');
  });

  it('draws nothing with no actions', () => {
    render();
    expect(container.innerHTML).toBe('');
  });

  it("holds the wall's place while the actions are read, with no chip to press", () => {
    quickActions.loading = true;
    render();
    const section = container.querySelector('[aria-label="Quick actions"]');
    expect(section?.innerHTML).toContain('data-loading-item');
    expect(section?.querySelectorAll('button[aria-label]')).toHaveLength(0);
  });

  it("draws its loading form in a loading scope: the dock's first frame, before its chat has loaded", () => {
    quickActions.value = [{ id: 'qa-1', name: 'Machines online', instructions: 'List every online machine' }];
    act(() =>
      root.render(
        <LoadingRegion label="Loading Mingo">
          <MingoDockQuickActions onPick={onPick} />
        </LoadingRegion>,
      ),
    );
    const set = container.querySelector('[aria-label="Quick actions"]');
    // Inset like the composer under it, at the set's distance from it: the loaded dock's box.
    expect(set?.parentElement?.className).toContain('mb-[var(--spacing-system-mf)]');
    expect(set?.innerHTML).toContain('data-loading-item');
  });
});
