/**
 * Mingo's quick actions over the docked composer on the home: the quick-action wall,
 * with no caption. A chip's click SENDS the action in a new chat through the dock's
 * send, hover or focus previews its instructions in the composer; with no actions
 * nothing is drawn.
 */

import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiQuickAction } from '@/app/(app)/settings/ai-settings/types/ai-settings';
import { useComposerPreviewStore } from './composer-preview-store';
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
  useComposerPreviewStore.setState({ text: null });
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
  const row = container.querySelector('[aria-label="Quick actions"]');
  const match = Array.from(row?.querySelectorAll('button') ?? []).find(b => b.textContent?.includes(label));
  if (!match) throw new Error(`no chip "${label}"`);
  return match;
}

describe('MingoDockQuickActions', () => {
  it('sends a quick action through the dock', () => {
    quickActions.value = [
      { id: 'qa-1', name: 'Machines online', instructions: 'List every online machine with its customer' },
    ];
    render();
    act(() => chip('Machines online').click());
    expect(onSend).toHaveBeenCalledExactlyOnceWith('List every online machine with its customer');
  });

  it("previews a quick action's instructions in the composer while hovered or focused", () => {
    quickActions.value = [
      { id: 'qa-1', name: 'Machines online', instructions: 'List every online machine with its customer' },
      { id: 'qa-2', name: 'Low disk', instructions: 'Which machines are low on disk?' },
    ];
    render();
    const preview = () => useComposerPreviewStore.getState().text;

    act(() => chip('Machines online').focus());
    expect(preview()).toBe('List every online machine with its customer');
    // Moving to the next chip: its preview, not a cleared one.
    act(() => chip('Low disk').focus());
    expect(preview()).toBe('Which machines are low on disk?');
    act(() => chip('Low disk').blur());
    expect(preview()).toBeNull();

    // A click sends, and nothing is left in the composer — nor once home is left.
    act(() => chip('Machines online').focus());
    act(() => chip('Machines online').click());
    expect(preview()).toBeNull();
    act(() => chip('Machines online').focus());
    act(() => root.unmount());
    expect(preview()).toBeNull();
    root = createRoot(container);
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
          <MingoDockQuickActions onSend={onSend} />
        </LoadingRegion>,
      ),
    );
    const section = container.querySelector('[aria-label="Quick actions"]');
    expect(section?.className).toContain('mb-[var(--spacing-system-mf)]');
    expect(section?.innerHTML).toContain('data-loading-item');
  });
});
