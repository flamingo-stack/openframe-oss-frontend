/**
 * The EXPIRES column the device tab and the tenant-wide page share: which
 * filter a row falls under is read against the caller's clock, and the funnel
 * offers exactly the Kept / Expiring / Expired options.
 */
import { describe, expect, it, vi } from 'vitest';
import type { RecordingSummary } from '../../types/session-recording';
import { REMOTE_SESSION_COLUMNS } from '../tabs/device-tab-columns';
import { remoteSessionColumns } from './remote-session-columns';
import { EXPIRES_FILTER_OPTIONS } from './session-status';

const NOW = Date.parse('2026-10-09T10:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const row = (overrides: Partial<RecordingSummary> = {}): RecordingSummary => ({
  id: 'session-1',
  deviceId: 'machine-1',
  startedAt: '2026-07-10T10:00:00Z',
  durationMs: 60_000,
  sizeBytes: 1024,
  protocol: 2,
  recordingState: 'ready',
  kept: false,
  keep: null,
  expiresAt: new Date(NOW + 3 * DAY_MS).toISOString(),
  recordingId: 'rec-1',
  employee: { name: 'Roman Smith' },
  ...overrides,
});

function expiresColumn() {
  const columns = remoteSessionColumns({
    dateFilter: { sortDirection: 'desc', range: undefined, onApply: vi.fn() },
    employeeOptions: [],
    now: NOW,
    onOpen: vi.fn(),
    onDelete: vi.fn(),
  });
  const column = columns.find(candidate => candidate.id === REMOTE_SESSION_COLUMNS.expires.id);
  if (!column) throw new Error('No EXPIRES column');
  return column as typeof column & {
    accessorFn: (summary: RecordingSummary, index: number) => unknown;
    meta: { filter: { options: unknown } };
  };
}

describe('remoteSessionColumns EXPIRES', () => {
  it('files rows under Kept, Expiring within a week of now, or Expired', () => {
    const { accessorFn } = expiresColumn();
    expect(accessorFn(row(), 0)).toBe('expiring');
    expect(accessorFn(row({ expiresAt: new Date(NOW + 8 * DAY_MS).toISOString() }), 0)).toBeNull();
    expect(accessorFn(row({ kept: true, expiresAt: null }), 0)).toBe('kept');
    expect(accessorFn(row({ recordingState: 'expired', expiresAt: null }), 0)).toBe('expired');
  });

  it('offers the Kept / Expiring / Expired funnel', () => {
    expect(expiresColumn().meta.filter.options).toEqual(EXPIRES_FILTER_OPTIONS);
    expect(EXPIRES_FILTER_OPTIONS.map(option => option.label)).toEqual(['Kept', 'Expiring', 'Expired']);
  });
});
