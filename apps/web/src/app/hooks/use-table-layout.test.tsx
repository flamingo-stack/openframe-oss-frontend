'use no memo';

/**
 * Every table screen reads ONE flag, so one switch on the server turns them all. Before the answer the gate is
 * `'loading'`, never a guess: a guess would draw one table and replace it with the other.
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
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
