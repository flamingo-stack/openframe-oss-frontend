/**
 * Pins what each row of the Remote Sessions tab offers per its recording's
 * state (Figma 1644-6911): the PROCESSING / FAILED tags, the EXPIRES cell,
 * and which rows can be deleted or opened. A delete goes out by session id.
 * With Watch live on, a running session reads LIVE and the list is polled.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDate } from '@/lib/format-date';
import type { Device } from '../../types/device.types';
import type { RecordingSummary } from '../../types/session-recording';
import type { LiveRows } from '../remote-sessions/session-status';
import { emptyDescription, RemoteSessionsTab } from './remote-sessions-tab';

const NOW = Date.parse('2026-10-08T12:00:00Z');

const hooks = vi.hoisted(() => ({
  rows: [] as RecordingSummary[],
  mutate: vi.fn(),
  liveRows: null as LiveRows | null,
  listOptions: vi.fn(),
}));

vi.mock('../../hooks/use-session-recordings', () => ({
  useSessionRecordings: (_deviceId: string | null, options?: { poll?: boolean }) => {
    hooks.listOptions(options);
    return { data: hooks.rows, isLoading: false };
  },
  useDeleteRemoteSession: () => ({ mutate: hooks.mutate, isPending: false }),
}));
vi.mock('../../hooks/use-remote-session-watch-gate', () => ({ useLiveRows: () => hooks.liveRows }));
vi.mock('@/app/hooks/use-now', () => ({ useNow: () => NOW }));
vi.mock('@/app/hooks/use-sticky-toolbar', () => ({
  useStickyToolbar: () => ({ toolbarRef: { current: null }, containerStyle: {}, stickyHeaderOffset: 0 }),
}));
vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: vi.fn(), commitMutation: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/devices/details',
  useSearchParams: () => new URLSearchParams(),
}));

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= ResizeObserverStub as unknown as typeof IntersectionObserver;
window.matchMedia ??= ((query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList) as typeof window.matchMedia;

const DEVICE = { id: 'mongo-1', machineId: 'machine-1', hostname: 'laptop-01' } as unknown as Device;

const session = (id: string, startedAt: string, overrides: Partial<RecordingSummary>): RecordingSummary => ({
  id,
  deviceId: 'machine-1',
  startedAt,
  durationMs: 60_000,
  sizeBytes: 1024,
  protocol: 2,
  recordingState: 'ready',
  live: false,
  kept: false,
  keep: null,
  expiresAt: null,
  recordingId: `${id}-file`,
  employee: { name: 'Roman Smith' },
  technicianId: 'tech-roman',
  ...overrides,
});

const READY = session('ready', '2026-07-10T10:00:00Z', { expiresAt: '2026-10-09T06:00:00Z' });
const PROCESSING = session('processing', '2026-10-08T11:00:00Z', {
  recordingState: 'processing',
  durationMs: null,
  sizeBytes: null,
  recordingId: null,
});
const FAILED = session('failed', '2026-10-07T10:00:00Z', { recordingState: 'failed', recordingId: null });
const KEPT = session('kept', '2026-05-02T10:00:00Z', {
  kept: true,
  keep: {
    keptBy: 'Dana Whitfield',
    keptAt: '2026-05-03T10:00:00Z',
    reason: 'CLIENT_DISPUTE',
    note: null,
    dueAt: '2026-07-31T10:00:00Z',
    expiresAtOnRelease: '2026-07-31T10:00:00Z',
  },
});
const EXPIRED = session('expired', '2026-06-01T10:00:00Z', { recordingState: 'expired' });
const NOT_RECORDED = session('none', '2026-04-01T10:00:00Z', { recordingState: 'none', recordingId: null });
const LIVE = session('live', '2026-10-09T09:00:00Z', {
  recordingState: 'none',
  live: true,
  durationMs: null,
  recordingId: null,
});
// Deleted earlier through the recording-only delete: the session is still listed.
const LEGACY_DELETED = session('deleted', '2026-03-01T10:00:00Z', { recordingState: 'deleted' });
const ROWS = [READY, PROCESSING, FAILED, KEPT, EXPIRED, NOT_RECORDED, LIVE, LEGACY_DELETED];

let container: HTMLDivElement;
let root: Root;

/** The row that shows this session's start date. */
function rowOf(row: RecordingSummary): HTMLElement {
  const date = formatDate(row.startedAt);
  const cell = Array.from(document.querySelectorAll<HTMLElement>('body *')).find(
    el => el.children.length === 0 && el.textContent === date,
  );
  let el: HTMLElement | null | undefined = cell;
  while (el && !el.querySelector('[aria-label="Delete session"]')) el = el.parentElement;
  if (!el) throw new Error(`No row for ${row.id}`);
  return el;
}

const button = (row: RecordingSummary, label: string) =>
  rowOf(row).querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  hooks.rows = ROWS;
  hooks.liveRows = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<RemoteSessionsTab device={DEVICE} />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('RemoteSessionsTab rows', () => {
  it('tags processing and failed sessions', () => {
    // The tag's own style uppercases the label.
    expect(rowOf(PROCESSING).textContent).toMatch(/processing/i);
    expect(rowOf(FAILED).textContent).toMatch(/failed/i);
    expect(rowOf(READY).textContent).not.toMatch(/processing|failed/i);
  });

  it('shows the expiry, the last-day countdown, Kept and Expired', () => {
    expect(rowOf(READY).textContent).toContain(formatDate(READY.expiresAt ?? ''));
    expect(rowOf(READY).textContent).toContain('Expires in 18 hours');
    expect(rowOf(KEPT).textContent).toContain('Kept');
    expect(rowOf(KEPT).textContent).toContain('Kept by Dana Whitfield · Client dispute');
    expect(rowOf(EXPIRED).textContent).toContain('Expired');
  });

  it('opens only rows with something to play, and deletes every ended session but processing and kept ones', () => {
    const open = (row: RecordingSummary) => !button(row, 'Open session recording')?.disabled;
    const del = (row: RecordingSummary) => !button(row, 'Delete session')?.disabled;

    expect(ROWS.map(open)).toEqual([true, false, false, true, false, false, false, false]);
    expect(ROWS.map(del)).toEqual([true, false, true, false, true, true, false, true]);
  });

  it('dims the trash glyph of a row that cannot be deleted', () => {
    const glyph = (row: RecordingSummary) => button(row, 'Delete session')?.querySelector('svg')?.getAttribute('class');
    expect(glyph(READY)).toContain('text-ods-error');
    expect(glyph(READY)).not.toContain('text-ods-error-secondary');
    expect(glyph(PROCESSING)).toContain('text-ods-error-secondary');
    expect(glyph(KEPT)).toContain('text-ods-error-secondary');
  });

  it('deletes a failed session by its session id, after a confirm that says it cannot be restored', () => {
    act(() => button(FAILED, 'Delete session')?.click());
    expect(document.body.textContent).toContain(
      "Its recording and session data will be deleted and can't be restored.",
    );
    const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      el => el.textContent === 'Delete Session',
    );
    act(() => confirm?.click());
    expect(hooks.mutate).toHaveBeenCalledWith({ sessionId: 'failed', recordingId: null }, expect.anything());
  });

  it('keeps a session deleted before as a greyed "Deleted" row', () => {
    expect(rowOf(LEGACY_DELETED).textContent).toContain('Deleted');
  });

  it('reads a running session by its recording and does not poll while Watch live is off', () => {
    expect(rowOf(LIVE).textContent).not.toMatch(/live/i);
    expect(button(LIVE, 'Open session recording')?.disabled).toBe(true);
    expect(hooks.listOptions).toHaveBeenLastCalledWith({ poll: false });
  });
});

describe('RemoteSessionsTab with Watch live on', () => {
  const COLLEAGUE_LIVE = session('colleague-live', '2026-10-06T08:00:00Z', {
    recordingState: 'processing',
    live: true,
    durationMs: null,
    sizeBytes: null,
    recordingId: null,
    technicianId: 'tech-dana',
  });
  const frame = (row: RecordingSummary) => rowOf(row).closest<HTMLElement>('[class*="bg-ods-card"]');

  beforeEach(() => {
    hooks.rows = [...ROWS, COLLEAGUE_LIVE];
    hooks.liveRows = { userId: 'tech-roman', remoteControl: true };
    act(() => root.render(<RemoteSessionsTab device={DEVICE} />));
  });

  it('tags running sessions LIVE, frames them, and leaves the other rows as they were', () => {
    expect(rowOf(LIVE).textContent).toMatch(/live/i);
    expect(rowOf(COLLEAGUE_LIVE).textContent).toMatch(/live/i);
    expect(rowOf(COLLEAGUE_LIVE).textContent).not.toMatch(/processing/i);
    expect(frame(LIVE)?.className).toContain('border-ods-error');
    expect(frame(READY)?.className).not.toContain('border-ods-error');
    expect(rowOf(PROCESSING).textContent).toMatch(/processing/i);
  });

  it("opens Remote Control from the signed-in technician's own running session, the live page from a colleague's", () => {
    expect(button(LIVE, 'Open Remote Control')?.disabled).toBe(false);
    expect(rowOf(LIVE).closest('a')?.getAttribute('href')).toBe('/devices/details/remote-desktop?id=machine-1');
    expect(button(COLLEAGUE_LIVE, 'Open live session')?.disabled).toBe(false);
    expect(rowOf(COLLEAGUE_LIVE).closest('a')?.getAttribute('href')).toBe(
      '/devices/details/live-session?id=colleague-live',
    );
    expect(button(READY, 'Open session recording')?.disabled).toBe(false);
  });

  it('shows no expiry on a running session, even one with a file already listed', () => {
    hooks.rows = [
      session('live-with-file', '2026-10-05T08:00:00Z', {
        live: true,
        durationMs: null,
        expiresAt: '2027-01-06T08:00:00Z',
      }),
    ];
    act(() => root.render(<RemoteSessionsTab device={DEVICE} />));
    expect(document.body.textContent).not.toContain(formatDate('2027-01-06T08:00:00Z'));
  });

  it('keeps Delete off for running sessions', () => {
    expect(button(LIVE, 'Delete session')?.disabled).toBe(true);
    expect(button(COLLEAGUE_LIVE, 'Delete session')?.disabled).toBe(true);
  });

  it('opens nothing from a running session where Remote Control is unavailable', () => {
    hooks.liveRows = { userId: 'tech-roman', remoteControl: false };
    act(() => root.render(<RemoteSessionsTab device={DEVICE} />));
    expect(button(LIVE, 'Open Remote Control')?.disabled).toBe(true);
  });

  it('polls the list', () => {
    expect(hooks.listOptions).toHaveBeenLastCalledWith({ poll: true });
  });
});

describe('emptyDescription', () => {
  it('names what narrowed the list, and only an un-narrowed list promises sessions', () => {
    const none = { search: '', hasDateRange: false, hasColumnFilters: false };
    expect(emptyDescription({ ...none, hasColumnFilters: true })).toBe('No sessions match the selected filters.');
    expect(emptyDescription({ ...none, hasDateRange: true, hasColumnFilters: true })).toBe(
      'No sessions in the selected date range.',
    );
    expect(emptyDescription({ ...none, search: 'roman', hasColumnFilters: true })).toBe('No results for "roman".');
    expect(emptyDescription(none)).toBe('Recorded remote sessions for this device will appear here.');
  });
});
