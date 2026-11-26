/**
 * The Security tab's agent cards on a Mac below Fleet's minimum: Orbit is installed there but never starts, so its
 * status says Not supported (as the Agents tab does), never Active.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Device } from '../../types/device.types';
import { SecurityTab } from './security-tab';

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

const withOrbit = {
  id: 'd1',
  machineId: 'm1',
  installedAgents: [
    { id: 'a1', machineId: 'm1', agentType: 'fleetmdm-agent', version: '4.70.0', createdAt: '', updatedAt: '' },
  ],
} as unknown as Device;

function orbitCard(): string {
  const text = container.textContent ?? '';
  return text.slice(text.indexOf('Orbit'));
}

describe('SecurityTab agent cards', () => {
  it('marks Orbit Not supported on an OS below the Fleet minimum', () => {
    act(() =>
      root.render(
        <SecurityTab
          device={{
            ...withOrbit,
            unsupportedTools: [{ toolType: 'FLEET_MDM', minOsVersion: '13.0', osVersion: '11.7.10' }],
          }}
        />,
      ),
    );

    expect(orbitCard()).toContain('4.70.0');
    expect(orbitCard()).toContain('Not supported');
    expect(orbitCard()).not.toContain('Active');
  });

  it('keeps Orbit Active otherwise', () => {
    act(() => root.render(<SecurityTab device={{ ...withOrbit, unsupportedTools: [] }} />));

    expect(orbitCard()).toContain('Active');
    expect(orbitCard()).not.toContain('Not supported');
  });
});
