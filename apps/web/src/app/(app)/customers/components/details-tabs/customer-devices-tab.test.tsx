/**
 * The customer's Devices tab links to that customer's archive, which came with Tenant Management Phase 2: without
 * `tenant-management-v2` (and while the flags are out) the tab is main's, with no Archive action.
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

import { CustomerDevicesTab } from './customer-devices-tab';

let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => root.render(<CustomerDevicesTab organizationId="org-1" />));
  return env.panel as DevicesPanelProps;
}

const flags = (v2: boolean) =>
  useFeatureFlagsStore.getState().setFlags([
    { name: 'tenant-management', enabled: true },
    { name: 'tenant-management-v2', enabled: v2 },
  ]);

describe("a customer's Devices tab", () => {
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

  it("links to the customer's own archive with tenant-management-v2 on", () => {
    flags(true);
    expect(render().archiveHref).toBe('/devices/archive?organizationId=org-1');
  });

  it("offers no archive with tenant-management-v2 off, as main's tab", () => {
    flags(false);
    const panel = render();
    expect(panel.archiveHref).toBeUndefined();
    expect(panel.lockedFilters).toEqual({ organizationIds: ['org-1'] });
  });

  it('offers no archive while the flags are out', () => {
    expect(render().archiveHref).toBeUndefined();
  });
});
