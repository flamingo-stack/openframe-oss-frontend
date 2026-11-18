import {
  CollisionBoundaryContext,
  PortalContainerContext,
} from '@flamingo-stack/openframe-frontend-core/dist/components/ui/portal-container.js';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MingoChatModelSelector } from './mingo-chat-model-selector';

let root: Root;
let container: HTMLDivElement;
const select = vi.fn();
const pointerMove = (element: Element) => {
  const event = new MouseEvent('pointermove', { bubbles: true, clientX: 100 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  element.dispatchEvent(event);
};
const row = (label: string) => {
  const item = [...document.querySelectorAll<HTMLElement>('[role^="menuitem"]')].find(
    candidate => candidate.textContent === label,
  );
  if (!item) throw new Error(`Missing menu item: ${label}`);
  return item;
};
const settle = () => new Promise(resolve => setTimeout(resolve, 30));
function Probe({ disabled = false }: { disabled?: boolean }) {
  const [open, onOpenChange] = useState(true);
  return (
    <PortalContainerContext.Provider value={container}>
      <CollisionBoundaryContext.Provider value={container}>
        <MingoChatModelSelector
          open={open}
          onOpenChange={onOpenChange}
          disabled={disabled}
          items={[
            {
              id: 'OPENAI',
              label: 'OpenAI',
              type: 'submenu',
              submenu: [{ id: 'gpt', label: 'GPT Test', type: 'radio', checked: false, disabled, onClick: select }],
            },
          ]}
        />
      </CollisionBoundaryContext.Provider>
    </PortalContainerContext.Provider>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(callback, 0));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  select.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('Mingo chat model selector production menu', () => {
  it('moves real pointer focus into a nested radio and selects it once', async () => {
    await act(async () => {
      root.render(<Probe />);
      await settle();
    });
    await act(async () => {
      row('OpenAI').click();
      await settle();
    });
    await act(async () => pointerMove(row('GPT Test')));
    expect(document.activeElement).toBe(row('GPT Test'));
    await act(async () => {
      row('GPT Test').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
      row('GPT Test').click();
    });
    expect(select).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
  it('selects a nested model by keyboard once and closes the overlay', async () => {
    await act(async () => {
      root.render(<Probe />);
      await settle();
    });
    await act(async () => {
      row('OpenAI').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await settle();
    });
    await act(async () => row('GPT Test').focus());
    await act(async () => row('GPT Test').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(select).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
  it('closes an already open model menu when creation protects the choice and keeps it closed afterward', async () => {
    await act(async () => {
      root.render(<Probe />);
      await settle();
    });
    await act(async () => {
      row('OpenAI').click();
      await settle();
    });
    expect(document.querySelectorAll('[role="menu"]').length).toBe(2);
    await act(async () => {
      root.render(<Probe disabled />);
      await settle();
    });
    expect(document.querySelector<HTMLButtonElement>('[aria-label="Change chat model"]')?.disabled).toBe(true);
    expect(document.querySelector('[role="menu"]')).toBeNull();
    await act(async () => {
      root.render(<Probe />);
      await settle();
    });
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });
  it('portals every nested overlay outside the clipping chat column', async () => {
    await act(async () => {
      root.render(<Probe />);
      await settle();
    });
    await act(async () => {
      row('OpenAI').click();
      await settle();
    });
    expect(document.querySelectorAll('[role="menu"]').length).toBe(2);
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });
});
