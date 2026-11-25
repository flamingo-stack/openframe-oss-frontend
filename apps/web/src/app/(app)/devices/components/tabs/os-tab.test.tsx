/**
 * The OS tab on a Mac below Fleet's minimum: Fleet's OS details never come, so the tab shows only the version the
 * OpenFrame client reports (Figma 5049-125023), or the unsupported placeholder before the client has reported one.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Device } from '../../types/device.types';
import { OsTab } from './os-tab';

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

function render(device: Partial<Device>) {
  act(() => root.render(<OsTab device={{ id: 'd1', machineId: 'm1', ...device } as Device} />));
}

describe('OsTab on an OS below the Fleet minimum', () => {
  it('shows only the OS card with the version the client reports', () => {
    render({
      sources: { fleet: 'skipped-unsupported' },
      osType: 'MAC_OS',
      osVersion: '11.7.10',
      osBuild: '20G1427',
      timezone: 'Europe/Kyiv',
    });

    const text = container.textContent ?? '';
    expect(text).toContain('Operating System');
    expect(text).toContain('macOS');
    expect(text).toContain('Reported by the OpenFrame client');
    expect(text).toContain('11.7.10');
    // Nothing else on the tab: no build, no Boot & Time card, no placeholder.
    expect(text).not.toContain('20G1427');
    expect(text).not.toContain('Boot & Time');
    expect(text).not.toContain('Not available on this macOS version');
  });

  it('shows the unsupported placeholder before the client has reported a version', () => {
    render({ sources: { fleet: 'skipped-unsupported' }, osType: 'MAC_OS' });

    expect(container.textContent).toContain('Not available on this macOS version');
  });

  it('keeps the full OS card for a supported device', () => {
    render({
      sources: { fleet: 'ok' },
      osType: 'MAC_OS',
      osVersion: '14.5',
      osBuild: '23F79',
      timezone: 'Europe/Kyiv',
    });

    const text = container.textContent ?? '';
    expect(text).toContain('23F79');
    expect(text).toContain('Boot & Time');
    expect(text).not.toContain('Reported by the OpenFrame client');
  });
});
