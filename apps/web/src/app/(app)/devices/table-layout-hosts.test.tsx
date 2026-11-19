/**
 * The screens that hand their table the app's one table flag (`data-table-grid`): the Devices archive, a customer's
 * Devices tab and the tenant's Remote Sessions list. Each reads the flag once and passes the layout down: the grid
 * table while it is on, card rows while it is off, and a loading form while it is read, so that a table never draws one
 * layout and swaps to the other.
 *
 * The tables are stand-ins that show what they were handed: the layout, the settings key and the loading scope.
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureFlagGate } from '@/lib/feature-flags';

const flags = vi.hoisted(() => ({ tableGrid: 'off' as FeatureFlagGate, recordings: 'on' as FeatureFlagGate }));
vi.mock('@/app/hooks/use-table-layout', () => ({
  useTableGridGate: () => flags.tableGrid,
  tableLayoutFor: (gate: FeatureFlagGate) => (gate === 'on' ? 'grid' : 'cards'),
}));
vi.mock('./hooks/use-session-recordings-gate', () => ({ useSessionRecordingsGate: () => flags.recordings }));
vi.mock('@/app/(app)/cloud-tenant-management/components/shared/use-tenant-management-gate', () => ({
  useTenantManagementV2Gate: () => 'off',
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/devices',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/app/hooks/use-safe-back', () => ({ useSafeBack: () => () => {} }));

interface PanelProps {
  tableLayout?: string;
  tableSettings?: { storageKey?: string };
  embedded?: boolean;
}
vi.mock('@/app/components/shared', async () => {
  const { useLoadingScope } = await import('@flamingo-stack/openframe-frontend-core/components/ui');
  return {
    NO_ITEMS: [],
    EmptyState: () => null,
    ContentErrorBoundary: ({ children }: { children: ReactNode }) => children,
    DevicesPanel: ({ tableLayout, tableSettings, embedded }: PanelProps) => (
      <div
        data-table={tableLayout}
        data-settings-key={tableSettings?.storageKey}
        data-embedded={embedded ? 'yes' : 'no'}
        data-loading={useLoadingScope() ? 'yes' : 'no'}
      />
    ),
  };
});
vi.mock('./components/remote-sessions/tenant-sessions-table', async () => {
  const { useLoadingScope } = await import('@flamingo-stack/openframe-frontend-core/components/ui');
  return {
    TenantSessionsShell: ({ tableLayout }: PanelProps) => (
      <div data-table={tableLayout} data-loading={useLoadingScope() ? 'yes' : 'no'} />
    ),
  };
});
vi.mock('./components/devices-tab-navigation', () => ({
  DevicesTabNavigation: () => null,
  REMOTE_SESSIONS_PAGE_TITLE: 'Remote Sessions',
}));
vi.mock('./components/remote-sessions/recording-storage-banner', () => ({ RecordingStorageBanner: () => null }));

import { CustomerDevicesTab } from '../customers/components/details-tabs/customer-devices-tab';
import ArchivedDevices from './archive/page';
import RemoteSessionsPage from './remote-sessions/page';

let container: HTMLDivElement;
let root: Root;

/** What the screen's table was handed. */
function table(node: ReactNode) {
  act(() => root.render(node));
  const drawn = container.querySelector('[data-table]');
  return {
    layout: drawn?.getAttribute('data-table'),
    key: drawn?.getAttribute('data-settings-key'),
    embedded: drawn?.getAttribute('data-embedded'),
    loading: drawn?.getAttribute('data-loading'),
  };
}

beforeEach(() => {
  flags.tableGrid = 'off';
  flags.recordings = 'on';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('the Devices archive', () => {
  it('is the grid table under its own settings key while the flag is on', () => {
    flags.tableGrid = 'on';
    expect(table(<ArchivedDevices />)).toEqual({
      layout: 'grid',
      key: 'devices-archive',
      embedded: 'no',
      loading: 'no',
    });
  });

  it('stays card rows while the flag is off', () => {
    expect(table(<ArchivedDevices />)).toMatchObject({ layout: 'cards', loading: 'no' });
  });

  it('draws its loading form, on card rows, while the flag is read', () => {
    flags.tableGrid = 'loading';
    expect(table(<ArchivedDevices />)).toMatchObject({ layout: 'cards', loading: 'yes' });
  });
});

describe("a customer's Devices tab", () => {
  it('is the grid table, embedded (natural height), under its own settings key while the flag is on', () => {
    flags.tableGrid = 'on';
    expect(table(<CustomerDevicesTab organizationId="org-1" />)).toEqual({
      layout: 'grid',
      key: 'customer-devices',
      embedded: 'yes',
      loading: 'no',
    });
  });

  it('stays card rows while the flag is off', () => {
    expect(table(<CustomerDevicesTab organizationId="org-1" />)).toMatchObject({ layout: 'cards', loading: 'no' });
  });

  it('draws its loading form, on card rows, while the flag is read', () => {
    flags.tableGrid = 'loading';
    expect(table(<CustomerDevicesTab organizationId="org-1" />)).toMatchObject({ layout: 'cards', loading: 'yes' });
  });
});

describe("the tenant's Remote Sessions list", () => {
  it('is the grid table while the flag is on', () => {
    flags.tableGrid = 'on';
    expect(table(<RemoteSessionsPage />)).toMatchObject({ layout: 'grid', loading: 'no' });
  });

  it('stays card rows while the flag is off', () => {
    expect(table(<RemoteSessionsPage />)).toMatchObject({ layout: 'cards', loading: 'no' });
  });

  it('draws its loading form while the table flag is read, and while the recordings gate is', () => {
    flags.tableGrid = 'loading';
    expect(table(<RemoteSessionsPage />)).toMatchObject({ layout: 'cards', loading: 'yes' });

    flags.tableGrid = 'on';
    flags.recordings = 'loading';
    expect(table(<RemoteSessionsPage />)).toMatchObject({ layout: 'grid', loading: 'yes' });
  });
});
