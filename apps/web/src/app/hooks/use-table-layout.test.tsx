'use no memo';

/**
 * Every table screen reads ONE flag, so one switch on the server turns them all. Before the answer the gate is
 * `'loading'`, never a guess: a guess would draw one table and replace it with the other.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagGate } from '@/lib/feature-flags';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { tableLayoutFor, useTableGridGate } from './use-table-layout';

/** The gate as a screen reads it now. */
function readGate(): FeatureFlagGate | null {
  const seen: { gate: FeatureFlagGate | null } = { gate: null };
  function Probe() {
    seen.gate = useTableGridGate();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(<Probe />));
  act(() => root.unmount());
  return seen.gate;
}

describe('useTableGridGate', () => {
  afterEach(() => useFeatureFlagsStore.getState().reset());

  it('is loading until the server has answered', () => {
    expect(readGate()).toBe('loading');
  });

  it('is on where the server serves the flag as true', () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'data-table-grid', enabled: true }]);
    expect(readGate()).toBe('on');
  });

  it('is off where the server serves it as false, and where it serves no value for it', () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'data-table-grid', enabled: false }]);
    expect(readGate()).toBe('off');

    useFeatureFlagsStore.getState().setFlags([{ name: 'insights', enabled: true }]);
    expect(readGate()).toBe('off');
  });
});

describe('tableLayoutFor', () => {
  it('draws the grid only for an answered on', () => {
    expect(tableLayoutFor('on')).toBe('grid');
    expect(tableLayoutFor('off')).toBe('cards');
    expect(tableLayoutFor('loading')).toBe('cards');
  });
});

describe("a developer's local switch (NEXT_PUBLIC_DATA_TABLE_GRID)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  /** The gate in a build of the given kind, on an environment whose server serves the flag as off. */
  async function gateWhereTheServerSaysOff(build: 'development' | 'production', localSwitch: string | undefined) {
    vi.stubEnv('NODE_ENV', build);
    vi.stubEnv('NEXT_PUBLIC_DATA_TABLE_GRID', localSwitch);
    // The switch is read once, when the module loads: load it again under these values, with the store it reads.
    vi.resetModules();
    const { useFeatureFlagsStore: store } = await import('@/stores/feature-flags-store');
    const { useTableGridGate: useGate } = await import('./use-table-layout');
    store.getState().setFlags([{ name: 'data-table-grid', enabled: false }]);

    const seen: { gate: FeatureFlagGate | null } = { gate: null };
    function Probe() {
      seen.gate = useGate();
      return null;
    }
    const root = createRoot(document.createElement('div'));
    act(() => root.render(<Probe />));
    act(() => root.unmount());
    return seen.gate;
  }

  it('turns the tables on in a development build, past a server that serves the flag as off', async () => {
    expect(await gateWhereTheServerSaysOff('development', 'true')).toBe('on');
  });

  it('is off unless set to true', async () => {
    expect(await gateWhereTheServerSaysOff('development', undefined)).toBe('off');
    expect(await gateWhereTheServerSaysOff('development', 'false')).toBe('off');
  });

  it("never applies in a build that ships: the server's answer stands", async () => {
    expect(await gateWhereTheServerSaysOff('production', 'true')).toBe('off');
  });
});
