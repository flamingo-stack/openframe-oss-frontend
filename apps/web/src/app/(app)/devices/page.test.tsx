/**
 * The Devices page draws the grid table only where the server serves `data-table-grid` as on. While the flags are
 * out, and where the flag is off or has no value, the panel keeps card rows.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DevicesPanelProps } from '@/app/components/shared';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

const env = vi.hoisted(() => ({ panel: null as DevicesPanelProps | null }));

// The shared barrel reaches modules with Relay tags, which need the Babel transform vitest does not run.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>()),
  graphql: () => ({}),
}));
vi.mock('@/app/components/shared', async importOriginal => ({
  ...(await importOriginal<object>()),
  DevicesPanel: (props: DevicesPanelProps) => {
    env.panel = props;
    return null;
  },
}));
vi.mock('./components/devices-tab-navigation', () => ({ DevicesTabNavigation: () => null }));
vi.mock('./hooks/use-has-organizations', () => ({
  useHasOrganizations: () => ({ hasOrganizations: true, isLoading: false }),
}));

import Devices from './page';

let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => root.render(<Devices />));
  return env.panel as DevicesPanelProps;
}

describe('the Devices page and the table flag', () => {
  beforeEach(() => {
    env.panel = null;
    useFeatureFlagsStore.getState().reset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('draws the grid table where the server serves the flag as on', () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'data-table-grid', enabled: true }]);
    expect(render().tableLayout).toBe('grid');
  });

  it('keeps card rows where the flag is off, and where the server serves no value for it', () => {
    useFeatureFlagsStore.getState().setFlags([{ name: 'data-table-grid', enabled: false }]);
    expect(render().tableLayout).toBe('cards');

    useFeatureFlagsStore.getState().setFlags([{ name: 'insights', enabled: true }]);
    expect(render().tableLayout).toBe('cards');
  });

  it('keeps card rows while the flags are out', () => {
    expect(render().tableLayout).toBe('cards');
  });
});
