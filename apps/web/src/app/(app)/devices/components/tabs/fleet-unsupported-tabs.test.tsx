/**
 * The Fleet-fed tabs on a Mac below Fleet's minimum with no live Fleet (`sources.fleet === 'skipped-unsupported'`):
 * the section will never fill there, so each says the macOS version is unsupported instead of "still deploying".
 * Hardware, OS and Security have their own test files; this one covers the tabs that only gained the placeholder.
 */
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Device, DeviceDataSources } from '../../types/device.types';
import { NetworkTab } from './network-tab';
import { TabUnsupportedEmptyState } from './tab-unsupported-empty-state';
import { UsersTab } from './users-tab';

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

const deviceWith = (fleet: DeviceDataSources['fleet']) => ({ id: 'd1', machineId: 'm1', sources: { fleet } }) as Device;

const TABS: [string, (device: Device) => ReactNode][] = [
  ['Network', device => <NetworkTab device={device} />],
  ['Users', device => <UsersTab device={device} />],
];

describe.each(TABS)('%s tab', (_name, renderTab) => {
  it('says the macOS version is unsupported when Fleet does not run on it', () => {
    act(() => root.render(renderTab(deviceWith('skipped-unsupported'))));

    expect(container.textContent).toContain('Not available on this macOS version');
    expect(container.textContent).not.toContain('finishes deploying');
  });

  it('keeps the deploying copy while a supported Fleet is still installing', () => {
    act(() => root.render(renderTab(deviceWith('skipped-pending'))));

    expect(container.textContent).toContain('finishes deploying');
    expect(container.textContent).not.toContain('Not available on this macOS version');
  });
});

describe('TabUnsupportedEmptyState', () => {
  it('says why the section is empty and how it fills', () => {
    act(() => root.render(<TabUnsupportedEmptyState icon={null} />));

    expect(container.textContent).toContain('Not available on this macOS version');
    expect(container.textContent).toContain('Upgrade macOS and Fleet installs automatically.');
  });
});
