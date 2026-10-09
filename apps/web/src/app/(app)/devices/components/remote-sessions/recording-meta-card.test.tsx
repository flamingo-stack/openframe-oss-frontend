/**
 * The recording page's meta card ends on the recording's expiry, or, while
 * the recording is kept, on who kept it, when and why instead.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatDate } from '@/lib/format-date';
import type { RecordingDetail } from '../../types/session-recording';
import { RecordingMetaCard } from './recording-meta-card';

const RECORDING: RecordingDetail = {
  id: 'session-1',
  deviceId: 'machine-1',
  startedAt: '2026-10-08T17:32:00Z',
  durationMs: 36_000,
  sizeBytes: 6 * 1024 ** 2,
  protocol: 2,
  recordingState: 'ready',
  kept: false,
  keep: null,
  expiresAt: '2027-01-06T17:32:00Z',
  recordingId: 'rec-1',
  employee: { name: 'Roman Smith' },
  hostname: 'oleksandrd',
  organization: { name: 'Acme' },
  segments: [],
  chat: [],
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe('RecordingMetaCard', () => {
  it('ends on the expiry date while the recording is not kept', () => {
    act(() => root.render(<RecordingMetaCard recording={RECORDING} />));
    expect(container.textContent).toContain('Expires on');
    expect(container.textContent).toContain(formatDate(RECORDING.expiresAt));
    expect(container.textContent).toContain('6 MB');
    expect(container.textContent).not.toContain('Kept by');
  });

  it('ends on who kept it, when and why while kept', () => {
    const kept: RecordingDetail = {
      ...RECORDING,
      kept: true,
      expiresAt: null,
      keep: {
        keptBy: 'Dana Whitfield',
        keptAt: '2026-10-09T10:00:00Z',
        reason: 'CLIENT_DISPUTE',
        note: null,
        dueAt: '2027-01-06T17:32:00Z',
        expiresAtOnRelease: '2027-01-06T17:32:00Z',
      },
    };
    act(() => root.render(<RecordingMetaCard recording={kept} />));
    expect(container.textContent).toContain('Kept by Dana Whitfield');
    expect(container.textContent).toContain(`on ${formatDate('2026-10-09T10:00:00Z')} for Client dispute`);
    expect(container.textContent).not.toContain('Expires on');
  });
});
