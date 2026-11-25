/**
 * The install steps' macOS note (Add Device, setup): shown for macOS only, as a warning that names the minimum and
 * what stays unavailable below it; other platforms get nothing.
 */
import type { OSPlatformId } from '@flamingo-stack/openframe-frontend-core/utils';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MacosFleetRequirementAlert } from './macos-fleet-requirement-alert';

// The lib measures text for truncation tooltips; jsdom has no ResizeObserver.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

// The lib reads the breakpoint for per-width line counts; jsdom has no matchMedia.
window.matchMedia ??= ((query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList) as typeof window.matchMedia;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('MacosFleetRequirementAlert', () => {
  it('warns under macOS that Fleet features need macOS 13 or later', () => {
    act(() => root.render(<MacosFleetRequirementAlert platform="darwin" />));

    const alert = container.querySelector('[role="status"]');
    expect(alert?.textContent).toContain('Fleet features need macOS 13 or later');
    expect(alert?.textContent).toContain('inventory, software, vulnerabilities and policies stay unavailable');
  });

  it.each<OSPlatformId>(['windows', 'linux'])('shows nothing for %s', platform => {
    act(() => root.render(<MacosFleetRequirementAlert platform={platform} />));

    expect(container.innerHTML).toBe('');
  });
});
