/**
 * The Devices page's tab strip holds its place while the session recordings gate is read, so the page does not
 * move down when it answers on; off, there is no strip.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { DevicesTabNavigation } from './devices-tab-navigation';

const gate = vi.hoisted(() => ({ value: 'loading' as FeatureFlagGate }));
vi.mock('../hooks/use-session-recordings-gate', () => ({ useSessionRecordingsGate: () => gate.value }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/devices',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// TabNavigation measures its tabs; jsdom has no ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

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

const render = (value: FeatureFlagGate) => {
  gate.value = value;
  act(() => root.render(<DevicesTabNavigation activeTab="list" />));
};

describe('DevicesTabNavigation', () => {
  it('holds the strip, inert, while the gate is read', () => {
    render('loading');
    expect(container.textContent).toContain('Devices List');
    expect(container.textContent).toContain('Remote Sessions');
    expect(container.querySelector('[inert]')).not.toBeNull();
  });

  it('draws the live strip once the gate answers on', () => {
    render('on');
    expect(container.textContent).toContain('Remote Sessions');
    expect(container.querySelector('[inert]')).toBeNull();
  });

  it('draws nothing when the gate answers off', () => {
    render('off');
    expect(container.innerHTML).toBe('');
  });
});
