/**
 * The archive is the only way to a deleted device, since no Status funnel offers DELETED. Opened from a customer's
 * Devices tab it must hold that customer's devices only, and lead back there.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DevicesPanelProps } from '@/app/components/shared';

const env = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  panel: null as DevicesPanelProps | null,
  back: [] as string[],
}));

// The shared barrel reaches modules with Relay tags, which need the Babel transform vitest does not run.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown> & { default?: Record<string, unknown> }>()),
  graphql: () => ({}),
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => env.searchParams }));
vi.mock('@/app/hooks/use-safe-back', () => ({
  useSafeBack: (fallback: string) => {
    env.back.push(fallback);
    return () => undefined;
  },
}));
vi.mock('@/app/components/shared', async importOriginal => ({
  ...(await importOriginal<object>()),
  DevicesPanel: (props: DevicesPanelProps) => {
    env.panel = props;
    return null;
  },
}));

import ArchivedDevices from './page';

let container: HTMLDivElement;
let root: Root;

function render(search: string) {
  env.searchParams = new URLSearchParams(search);
  act(() => root.render(<ArchivedDevices />));
  return env.panel as DevicesPanelProps;
}

describe('the devices archive', () => {
  beforeEach(() => {
    env.panel = null;
    env.back = [];
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("holds every customer's deleted devices and goes back to Devices", () => {
    const panel = render('');
    expect(panel.lockedFilters).toEqual({ statuses: ['DELETED', 'ARCHIVED'] });
    expect(panel.hideColumns).toBeUndefined();
    expect(panel.backButton?.label).toBe('Back to Devices');
    expect(env.back.at(-1)).toBe('/devices');
  });

  it("holds one customer's when opened from its Devices tab, and goes back there", () => {
    const panel = render('?organizationId=org-1');
    expect(panel.lockedFilters).toEqual({ statuses: ['DELETED', 'ARCHIVED'], organizationIds: ['org-1'] });
    expect(panel.hideColumns).toEqual(['organization']);
    expect(panel.hideFilters).toEqual(['status', 'organization']);
    expect(panel.backButton?.label).toBe('Back to Customer');
    expect(env.back.at(-1)).toBe('/customers/details?id=org-1&tab=devices');
  });
});
