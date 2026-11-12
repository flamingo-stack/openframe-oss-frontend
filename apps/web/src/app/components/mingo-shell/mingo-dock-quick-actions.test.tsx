/**
 * Mingo's quick actions over the docked composer: the quick-action set, with no caption. A
 * chip's click hands the action's instructions to the dock (`onSend`), which sends them at once; with no actions nothing is drawn.
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

const onSend = vi.fn<(text: string) => void>();
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  onSend.mockClear();
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
  act(() => root.render(<MingoDockQuickActions onSend={onSend} />));
}

function chip(label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(label));
  if (!match) throw new Error(`no chip "${label}"`);
  return match;
}

describe('MingoDockQuickActions', () => {
  it('hands a clicked quick action to the dock, which sends it', () => {
    quickActions.value = [
      { id: 'qa-1', name: 'Machines online', instructions: 'List every online machine with its customer' },
    ];
    render();
    act(() => chip('Machines online').click());
    expect(onSend).toHaveBeenCalledExactlyOnceWith('List every online machine with its customer');
  });

  // Figma `chat/dock` (node 4368:14042): OpenFrame's quick-action glyphs, "All" among them, are grey.
  it("draws the actions' icons and the All glyph in the shell's grey", () => {
    quickActions.value = [
      { id: 'qa-1', name: 'Machines online', instructions: 'List every online machine', iconName: 'search' },
      { id: 'qa-2', name: 'Run a script', instructions: 'Run a script', iconName: 'code' },
    ];
    render();
    expect(chip('Machines online').querySelector('.text-ods-text-panel-secondary')).not.toBeNull();
    const all = container.querySelector('[data-testid="quick-action-row-all-glyph"]');
    expect(all?.classList.contains('text-ods-text-panel-secondary')).toBe(true);
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
    expect(container.innerHTML).toContain('data-loading-item');
    expect(container.querySelectorAll('button[aria-label]')).toHaveLength(0);
  });

  it("draws its loading form in a loading scope: the dock's first frame, before its chat has loaded", () => {
    quickActions.value = [{ id: 'qa-1', name: 'Machines online', instructions: 'List every online machine' }];
    act(() =>
      root.render(
        <LoadingRegion label="Loading Mingo">
          <MingoDockQuickActions onSend={onSend} />
        </LoadingRegion>,
      ),
    );
    // Inset like the composer under it, at the row's distance from it: the loaded dock's box.
    expect(container.innerHTML).toContain('mb-[var(--spacing-system-xs)]');
    expect(container.innerHTML).toContain('data-loading-item');
  });
});
