/**
 * The Hardware tab renders while its device is still being read (a loading scope, `device` null) and for a device
 * that reports no Fleet disk totals: neither may format a missing number.
 */
import { LoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Device } from '../../types/device.types';
import { HardwareTab } from './hardware-tab';

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

describe('HardwareTab', () => {
  it('renders in a loading scope with no device', () => {
    expect(() =>
      act(() =>
        root.render(
          <LoadingScope>
            <HardwareTab device={null} />
          </LoadingScope>,
        ),
      ),
    ).not.toThrow();
    expect(container.textContent).toContain('Disk');
  });

  it('renders a device that reports no Fleet disk totals', () => {
    expect(() => act(() => root.render(<HardwareTab device={{ id: 'd1' } as unknown as Device} />))).not.toThrow();
  });

  it('says the OS is unsupported, not "still deploying", when Fleet does not run on it', () => {
    act(() => root.render(<HardwareTab device={{ id: 'd1', sources: { fleet: 'skipped-unsupported' } } as Device} />));
    expect(container.textContent).toContain('Not available on this macOS version');
    expect(container.textContent).toContain('Upgrade macOS and Fleet installs automatically.');
    expect(container.textContent).not.toContain('finishes deploying');
  });

  it('keeps the deploying copy while a supported Fleet is still installing', () => {
    act(() => root.render(<HardwareTab device={{ id: 'd1', sources: { fleet: 'skipped-pending' } } as Device} />));
    expect(container.textContent).toContain('finishes deploying');
    expect(container.textContent).not.toContain('Not available on this macOS version');
  });
});
