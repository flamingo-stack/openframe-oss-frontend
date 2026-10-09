/**
 * The tenant-wide Remote Sessions page: the URL state becomes the server's
 * filter and sort, single-value funnels keep the newest pick, a session row
 * carries its device and customer, and the DEVICE / CUSTOMER cells name them.
 */
import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dateRangeToInstantBounds } from '@/lib/date-filter-params';
import { EMPTY_VALUE } from '@/lib/empty-value';
import {
  keepLastPick,
  TENANT_SESSION_COLUMNS,
  type TenantSessionRow,
  type TenantSessionsParams,
  tenantSessionColumns,
  tenantSessionsVariables,
  toTenantSessionRow,
} from './tenant-session-columns';

// `@inline` fragments are read with `readInlineData`; the wire objects below stand in for the ref.
vi.mock('relay-runtime', () => ({ readInlineData: (_fragment: unknown, ref: unknown) => ref }));
vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: vi.fn() }));

const PARAMS: TenantSessionsParams = {
  device: [],
  customer: [],
  expires: [],
  dateFrom: '',
  dateTo: '',
  sortDir: 'desc',
};

describe('tenantSessionsVariables', () => {
  it('sends no filter and the newest-first date sort by default', () => {
    expect(tenantSessionsVariables(PARAMS, undefined)).toEqual({
      filter: {},
      sort: { field: 'DATE', direction: 'DESC' },
    });
  });

  it('sends the devices, one customer, the recording state, the day range and the date order', () => {
    const range = { from: new Date(2026, 9, 1), to: new Date(2026, 9, 9) };
    const bounds = dateRangeToInstantBounds(range);
    expect(
      tenantSessionsVariables(
        { ...PARAMS, device: ['m-1', 'm-2'], customer: ['org-1'], expires: ['kept'], sortDir: 'asc' },
        range,
      ),
    ).toEqual({
      filter: {
        deviceIds: ['m-1', 'm-2'],
        organizationId: 'org-1',
        recordingState: 'KEPT',
        from: bounds.from,
        to: bounds.to,
      },
      sort: { field: 'DATE', direction: 'ASC' },
    });
  });

  it('maps every EXPIRES pick to its list state', () => {
    const state = (value: string) => tenantSessionsVariables({ ...PARAMS, expires: [value] }, undefined).filter;
    expect(state('expiring')).toEqual({ recordingState: 'EXPIRING' });
    expect(state('expired')).toEqual({ recordingState: 'EXPIRED' });
    expect(state('unknown')).toEqual({});
  });
});

describe('keepLastPick', () => {
  it('keeps only the newest pick of a single-value funnel', () => {
    expect(keepLastPick([], ['org-1'])).toEqual(['org-1']);
    expect(keepLastPick(['org-1'], ['org-1', 'org-2'])).toEqual(['org-2']);
    expect(keepLastPick(['org-1'], [])).toEqual([]);
    expect(keepLastPick([], ['org-1', 'org-2'])).toEqual(['org-2']);
  });
});

const NODE = {
  sessionId: 'session-1',
  deviceId: 'machine-1',
  startedAt: '2026-10-08T17:32:00Z',
  durationMs: 36_000,
  recordingState: 'READY',
  recordingExpiresAt: '2027-01-06T17:32:00Z',
  recordingHold: null,
  dialogId: null,
  technician: { name: 'Roman Smith', avatarUrl: null },
  organization: { organizationId: 'org-1', name: 'Acme', logoUrl: 'https://cdn.example/acme.png' },
  recordings: [
    { recordingId: 'rec-1', sizeBytes: 100, protocol: 2, downloadUrl: '/download/rec-1', status: 'AVAILABLE' },
  ],
  device: { machineId: 'machine-1', displayName: 'Front Desk', hostname: 'front-desk.local' },
};

describe('toTenantSessionRow', () => {
  it("adds the session's device and customer to the device tab's row", () => {
    const row = toTenantSessionRow(NODE as unknown as Parameters<typeof toTenantSessionRow>[0]);
    expect(row).toMatchObject({
      id: 'session-1',
      recordingState: 'ready',
      recordingId: 'rec-1',
      device: { machineId: 'machine-1', name: 'Front Desk', hostname: 'front-desk.local' },
      customer: { id: 'org-1', name: 'Acme', logoUrl: 'https://cdn.example/acme.png' },
    });
  });

  it('names a device without a display name by its hostname, and keeps a gone device empty', () => {
    const unnamed = toTenantSessionRow({
      ...NODE,
      device: { machineId: 'machine-1', displayName: null, hostname: 'front-desk.local' },
    } as unknown as Parameters<typeof toTenantSessionRow>[0]);
    expect(unnamed.device?.name).toBe('front-desk.local');
    const gone = toTenantSessionRow({ ...NODE, device: null } as unknown as Parameters<typeof toTenantSessionRow>[0]);
    expect(gone.device).toBeNull();
  });
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // TruncateText measures its text; jsdom has no ResizeObserver.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

describe('tenantSessionColumns', () => {
  const columns = tenantSessionColumns({
    dateFilter: { sortDirection: 'desc', range: undefined, onApply: vi.fn() },
    deviceOptions: [{ id: 'machine-1', value: 'machine-1', label: 'Front Desk' }],
    customerOptions: [{ id: 'org-1', value: 'org-1', label: 'Acme' }],
    optionsPending: false,
    now: Date.parse('2026-10-09T10:00:00Z'),
    onOpen: vi.fn(),
    onDelete: vi.fn(),
  });

  it('lays out SESSION, DEVICE, CUSTOMER, EXPIRES and the actions', () => {
    expect(columns.map(column => column.id)).toEqual([
      TENANT_SESSION_COLUMNS.session.id,
      TENANT_SESSION_COLUMNS.device.id,
      TENANT_SESSION_COLUMNS.customer.id,
      TENANT_SESSION_COLUMNS.expires.id,
      TENANT_SESSION_COLUMNS.actions.id,
    ]);
  });

  const renderCell = (id: string, row: TenantSessionRow) => {
    const column = columns.find(candidate => candidate.id === id);
    const cell = column?.cell as (context: { row: { original: TenantSessionRow } }) => ReactNode;
    act(() => root.render(<>{cell({ row: { original: row } })}</>));
    return container.textContent ?? '';
  };

  it('names the device with its hostname, and the customer', () => {
    const row = toTenantSessionRow(NODE as unknown as Parameters<typeof toTenantSessionRow>[0]);
    expect(renderCell(TENANT_SESSION_COLUMNS.device.id, row)).toContain('Front Desk');
    expect(renderCell(TENANT_SESSION_COLUMNS.device.id, row)).toContain('front-desk.local');
    expect(renderCell(TENANT_SESSION_COLUMNS.customer.id, row)).toContain('Acme');
  });

  it('reads the empty value for a session whose device is gone', () => {
    const row = toTenantSessionRow({ ...NODE, device: null } as unknown as Parameters<typeof toTenantSessionRow>[0]);
    expect(renderCell(TENANT_SESSION_COLUMNS.device.id, row)).toBe(EMPTY_VALUE);
  });
});
