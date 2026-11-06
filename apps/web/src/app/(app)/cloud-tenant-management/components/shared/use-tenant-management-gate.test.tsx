// Pins the tri-state: the module must not read "not answered yet" as "off",
// and a server that does not know the name keeps it off — there is no dev fallback.

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { featureFlags } from '@/lib/feature-flags';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { useTenantManagementGate, useTenantManagementV2Gate } from './use-tenant-management-gate';

let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useTenantManagementGate> | null = null;

function Probe({ useGate }: { useGate: () => ReturnType<typeof useTenantManagementGate> }) {
  const gate = useGate();
  // Recorded after the commit, never during render (react-hooks/globals).
  useEffect(() => {
    latest = gate;
  });
  return null;
}

function mount(useGate: () => ReturnType<typeof useTenantManagementGate>) {
  useFeatureFlagsStore.getState().reset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(<Probe useGate={useGate} />);
  });
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  latest = null;
});

describe('useTenantManagementGate', () => {
  beforeEach(() => mount(useTenantManagementGate));

  it('is loading until the flags query has answered', () => {
    expect(latest).toBe('loading');
  });

  it('is off when the server answered without the flag (unknown name)', () => {
    act(() => useFeatureFlagsStore.getState().setFlags([]));
    expect(latest).toBe('off');
  });

  it('is on when the server enabled it', () => {
    act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'tenant-management', enabled: true }]));
    expect(latest).toBe('on');
  });

  it('is off when the server explicitly disabled it', () => {
    act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'tenant-management', enabled: false }]));
    expect(latest).toBe('off');
  });
});

// Phase 2 needs phase 1: the backend serves the phase-2 schema only under both.
describe('useTenantManagementV2Gate', () => {
  beforeEach(() => mount(useTenantManagementV2Gate));

  it('is loading until the flags query has answered', () => {
    expect(latest).toBe('loading');
    expect(featureFlags.tenantManagementV2.enabled()).toBe(false);
  });

  it('is on only when both flags are on', () => {
    act(() =>
      useFeatureFlagsStore.getState().setFlags([
        { name: 'tenant-management', enabled: true },
        { name: 'tenant-management-v2', enabled: true },
      ]),
    );
    expect(latest).toBe('on');
    expect(featureFlags.tenantManagementV2.enabled()).toBe(true);
  });

  it.each([
    ['phase 2 alone', [{ name: 'tenant-management-v2', enabled: true }]],
    ['phase 1 alone', [{ name: 'tenant-management', enabled: true }]],
    [
      'phase 2 explicitly off',
      [
        { name: 'tenant-management', enabled: true },
        { name: 'tenant-management-v2', enabled: false },
      ],
    ],
    ['neither', []],
  ])('is off with %s', (_, flags) => {
    act(() => useFeatureFlagsStore.getState().setFlags(flags));
    expect(latest).toBe('off');
    expect(featureFlags.tenantManagementV2.enabled()).toBe(false);
  });
});
