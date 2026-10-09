/**
 * Pins the fullscreen toolbar's buttons to Figma 1755-95622: actions, chat,
 * exit fullscreen, settings - all icon buttons, the chat one only when the
 * session has a chat, and pressed while the chat is open.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FullscreenToolbar } from './fullscreen-toolbar';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

let container: HTMLDivElement;
let root: Root;
const onToggleChat = vi.fn();

function render(chat: { open: boolean } | null) {
  act(() =>
    root.render(
      <FullscreenToolbar
        deviceName="Anthony's Device"
        displayMenuGroups={[]}
        currentDisplayLabel="Display 1"
        actionsMenuGroups={[]}
        onOpenSettings={vi.fn()}
        onExitFullscreen={vi.fn()}
        chatOpen={chat?.open}
        onToggleChat={chat ? onToggleChat : undefined}
      />,
    ),
  );
}

const buttonLabels = () =>
  Array.from(container.querySelectorAll('button')).map(button => button.getAttribute('aria-label'));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('FullscreenToolbar', () => {
  it('orders actions, chat, exit fullscreen, settings - all icon buttons', () => {
    render({ open: false });
    expect(buttonLabels()).toEqual(['Actions', 'Open chat', 'Exit fullscreen', 'Settings']);
    expect(container.textContent).not.toMatch(/Open Chat|Close Chat/);
  });

  it('marks the chat button pressed while the chat is open, and toggles it', () => {
    render({ open: true });
    const chat = container.querySelector<HTMLButtonElement>('[aria-label="Close chat"]');
    expect(chat?.getAttribute('aria-pressed')).toBe('true');
    act(() => chat?.click());
    expect(onToggleChat).toHaveBeenCalledTimes(1);
  });

  it('has no chat button for a session without a chat', () => {
    render(null);
    expect(buttonLabels()).toEqual(['Actions', 'Exit fullscreen', 'Settings']);
  });
});
