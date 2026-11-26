// Pins what the device status gate draws while it waits: the shell's stand-in for the page (a landing route's skeleton,
// CU-17tkuw69uzq) or nothing outside a shell, and the page itself once the flags and the MANAGED answer are in.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceStatusSupportGate } from './device-status-support-gate';
import { PageFallbackProvider } from './page-fallback-context';

const { state } = vi.hoisted(() => ({ state: { flagsReady: false, known: false } }));

vi.mock('@/app/hooks/use-feature-flag', () => ({ useFeatureFlagsReady: () => state.flagsReady }));
vi.mock('@/lib/device-status-support', () => ({
  isManagedStatusSupportKnown: () => state.known,
  readStoredManagedStatusSupport: () => null,
  setManagedStatusSupported: vi.fn(),
}));
vi.mock('@/lib/device-status-probe', () => ({ resolveManagedStatusSupport: () => new Promise<boolean>(() => {}) }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  state.flagsReady = false;
  state.known = false;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

const page = <p data-page="" />;
const skeleton = <p data-skeleton="" />;

describe('DeviceStatusSupportGate', () => {
  it('draws the shell’s stand-in while it waits', () => {
    act(() =>
      root.render(
        <PageFallbackProvider value={skeleton}>
          <DeviceStatusSupportGate>{page}</DeviceStatusSupportGate>
        </PageFallbackProvider>,
      ),
    );
    expect(container.querySelector('[data-skeleton]')).not.toBeNull();
    expect(container.querySelector('[data-page]')).toBeNull();
  });

  it('draws nothing while it waits outside a shell', () => {
    act(() => root.render(<DeviceStatusSupportGate>{page}</DeviceStatusSupportGate>));
    expect(container.innerHTML).toBe('');
  });

  it('draws the page once the flags and the answer are in', () => {
    state.flagsReady = true;
    state.known = true;
    act(() =>
      root.render(
        <PageFallbackProvider value={skeleton}>
          <DeviceStatusSupportGate>{page}</DeviceStatusSupportGate>
        </PageFallbackProvider>,
      ),
    );
    expect(container.querySelector('[data-page]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton]')).toBeNull();
  });

  it('draws the page when the flags never answer, once the fail-open window has passed (CU-17tkuw69v8q)', () => {
    state.known = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    act(() =>
      root.render(
        <PageFallbackProvider value={skeleton}>
          <DeviceStatusSupportGate>{page}</DeviceStatusSupportGate>
        </PageFallbackProvider>,
      ),
    );
    act(() => vi.advanceTimersByTime(9_999));
    expect(container.querySelector('[data-skeleton]')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(container.querySelector('[data-page]')).not.toBeNull();
    expect(container.querySelector('[data-skeleton]')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
