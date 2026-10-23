/**
 * Mingo's quick actions over the docked composer on the home, as the design places them:
 * a "Quick actions" caption with "What to ask Mingo?", over the quick-action wall. A
 * chip's click SENDS the action in a new chat through the dock's send, hover or focus
 * previews its instructions in the composer; with no actions only the caption row stays.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiQuickAction } from '@/app/(app)/settings/ai-settings/types/ai-settings';
import { useComposerPreviewStore } from './composer-preview-store';
import { MingoDockQuickActions } from './mingo-dock-quick-actions';

const { quickActions } = vi.hoisted(() => ({ quickActions: { value: [] as AiQuickAction[] } }));
vi.mock('@/app/(app)/mingo/hooks/use-mingo-quick-actions', () => ({ useMingoQuickActions: () => quickActions.value }));

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
const onWhatToAsk = vi.fn();
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  onSend.mockClear();
  onWhatToAsk.mockClear();
  quickActions.value = [];
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
  act(() => root.render(<MingoDockQuickActions onSend={onSend} onWhatToAsk={onWhatToAsk} />));
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

  it('offers "What to ask Mingo?" beside the caption, with or without actions', () => {
    render();
    expect(container.querySelector('h2')?.textContent).toBe('Quick actions');
    expect(container.querySelectorAll('button')).toHaveLength(1);
    act(() => chip('What to ask Mingo?').click());
    expect(onWhatToAsk).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });
});
