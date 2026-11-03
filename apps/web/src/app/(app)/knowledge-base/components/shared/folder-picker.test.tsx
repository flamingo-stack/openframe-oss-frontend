/**
 * Pins that the folder picker opens: its field is the menu's `asChild` trigger, so the
 * handlers and `aria-*` state Radix puts on it have to reach the button. When they did
 * not, the field drew as a select and a click did nothing, in every dialog that moves,
 * files or unarchives an item.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FOLDERS = vi.hoisted(() => [
  { id: 'f-guides', name: 'Guides', parentId: null },
  { id: 'f-windows', name: 'Windows', parentId: 'f-guides' },
  { id: 'f-test', name: 'test', parentId: null },
]);

// The real module carries graphql tags, which need the Relay babel plugin vitest does not run.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
  useLazyLoadQuery: () => ({ knowledgeBaseFolderTree: FOLDERS }),
}));
vi.mock('relay-runtime', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  readInlineData: (_fragment: unknown, ref: unknown) => ref,
}));

// The menu's popper measures itself; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { FolderPicker } from './folder-picker';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(onSelect = vi.fn()) {
  act(() => {
    root.render(<FolderPicker value={undefined} onSelect={onSelect} />);
  });
  const trigger = Array.from(container.querySelectorAll('button')).find(
    button => button.textContent === 'Select Folder',
  );
  if (!trigger) throw new Error('no folder field');
  return trigger;
}

function open(trigger: HTMLButtonElement): HTMLElement[] {
  act(() => {
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
  });
  return Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
}

describe('FolderPicker', () => {
  it('is a menu trigger', () => {
    const trigger = render();
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens on a click with the root and the top-level folders', () => {
    const trigger = render();
    const labels = open(trigger).map(item => item.textContent);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(labels).toEqual(['Knowledge Base', 'Guides', 'test']);
  });

  it('hands the picked folder over', () => {
    const onSelect = vi.fn();
    const picked = open(render(onSelect)).find(item => item.textContent === 'test');
    if (!picked) throw new Error('no folder "test"');
    act(() => picked.click());
    expect(onSelect).toHaveBeenCalledWith({ id: 'f-test', name: 'test' });
  });
});
