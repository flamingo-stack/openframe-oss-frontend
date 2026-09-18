// Pins the tri-state: the module must not read "not answered yet" as "off",
// and an explicit server "off" wins over the dev fallback (which only stands in
// for a name the server does not know). vitest runs with NODE_ENV=test.

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { useTenantManagementGate } from './use-tenant-management-gate';

let container: HTMLDivElement;
let root: Root;
let latest: ReturnType<typeof useTenantManagementGate> | null = null;

function Probe() {
  const gate = useTenantManagementGate();
  // Recorded after the commit, never during render (react-hooks/globals).
  useEffect(() => {
    latest = gate;
  });
  return null;
}

describe('useTenantManagementGate', () => {
  beforeEach(() => {
    useFeatureFlagsStore.getState().reset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(<Probe />);
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    latest = null;
  });

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

  it('is off when the server explicitly disabled it — the dev fallback only covers an unknown name', () => {
    act(() => useFeatureFlagsStore.getState().setFlags([{ name: 'tenant-management', enabled: false }]));
    expect(latest).toBe('off');
  });
});
