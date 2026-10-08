/**
 * Pins what each row of the Remote Sessions tab offers per its recording's
 * state (Figma 1644-6911): the PROCESSING / FAILED tags, the EXPIRES cell,
 * and which rows can be deleted or opened. A delete goes out by session id.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDate } from '@/lib/format-date';
import type { Device } from '../../types/device.types';
import type { RecordingSummary } from '../../types/session-recording';
import { RemoteSessionsTab } from './remote-sessions-tab';

const NOW = Date.parse('2026-10-08T12:00:00Z');

const hooks = vi.hoisted(() => ({ rows: [] as RecordingSummary[], mutate: vi.fn() }));

vi.mock('../../hooks/use-session-recordings', () => ({
  useSessionRecordings: () => ({ data: hooks.rows, isLoading: false }),
  useDeleteSessionRecording: () => ({ mutate: hooks.mutate, isPending: false }),
}));
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
  kept: false,
  expiresAt: null,
  recordingId: `${id}-file`,
  employee: { name: 'Roman Smith' },
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
const KEPT = session('kept', '2026-05-02T10:00:00Z', { kept: true });
const EXPIRED = session('expired', '2026-06-01T10:00:00Z', { recordingState: 'expired' });

let container: HTMLDivElement;
let root: Root;

/** The row that shows this session's start date. */
function rowOf(row: RecordingSummary): HTMLElement {
  const date = formatDate(row.startedAt);
  const cell = Array.from(document.querySelectorAll<HTMLElement>('body *')).find(
    el => el.children.length === 0 && el.textContent === date,
  );
  let el: HTMLElement | null | undefined = cell;
  while (el && !el.querySelector('[aria-label="Delete recording"]')) el = el.parentElement;
  if (!el) throw new Error(`No row for ${row.id}`);
  return el;
}

const button = (row: RecordingSummary, label: string) =>
  rowOf(row).querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  hooks.rows = [READY, PROCESSING, FAILED, KEPT, EXPIRED];
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
    expect(rowOf(PROCESSING).textContent).toContain('PROCESSING');
    expect(rowOf(FAILED).textContent).toContain('FAILED');
    expect(rowOf(READY).textContent).not.toMatch(/PROCESSING|FAILED/);
  });

  it('shows the expiry, the last-day countdown, Kept and Expired', () => {
    expect(rowOf(READY).textContent).toContain(formatDate(READY.expiresAt ?? ''));
    expect(rowOf(READY).textContent).toContain('Expires in 18 hours');
    expect(rowOf(KEPT).textContent).toContain('Kept');
    expect(rowOf(EXPIRED).textContent).toContain('Expired');
  });

  it('opens only rows with something to play, and deletes all but processing and kept ones', () => {
    const open = (row: RecordingSummary) => !button(row, 'Open session recording')?.disabled;
    const del = (row: RecordingSummary) => !button(row, 'Delete recording')?.disabled;

    expect([READY, PROCESSING, FAILED, KEPT, EXPIRED].map(open)).toEqual([true, false, false, true, false]);
    expect([READY, PROCESSING, FAILED, KEPT, EXPIRED].map(del)).toEqual([true, false, true, false, true]);
  });

  it('deletes a failed session by its session id', () => {
    act(() => button(FAILED, 'Delete recording')?.click());
    const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      el => el.textContent === 'Delete Recording',
    );
    act(() => confirm?.click());
    expect(hooks.mutate).toHaveBeenCalledWith({ sessionId: 'failed', recordingId: null }, expect.anything());
  });
});
