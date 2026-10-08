import { describe, expect, it } from 'vitest';
import type { RecordingSummary } from '../../types/session-recording';
import {
  canDeleteSession,
  canOpenSession,
  expiresFilterValue,
  expiresSoonLabel,
  isRecordingGone,
} from './session-status';

type Row = Pick<RecordingSummary, 'recordingState' | 'kept' | 'expiresAt' | 'recordingId'>;

const row = (overrides: Partial<Row> = {}): Row => ({
  recordingState: 'ready',
  kept: false,
  expiresAt: '2026-12-24T10:00:00Z',
  recordingId: 'rec-1',
  ...overrides,
});

describe('session row status', () => {
  it('opens only a session with something left to play', () => {
    expect(canOpenSession(row())).toBe(true);
    expect(canOpenSession(row({ kept: true }))).toBe(true);
    for (const recordingState of ['processing', 'failed', 'expired', 'deleted', 'none'] as const) {
      expect(canOpenSession(row({ recordingState }))).toBe(false);
    }
    expect(canOpenSession(row({ recordingId: null }))).toBe(false);
  });

  it('deletes ready, failed and expired recordings, never a kept or processing one', () => {
    expect(canDeleteSession(row())).toBe(true);
    expect(canDeleteSession(row({ recordingState: 'failed', recordingId: null }))).toBe(true);
    expect(canDeleteSession(row({ recordingState: 'expired' }))).toBe(true);
    expect(canDeleteSession(row({ kept: true }))).toBe(false);
    for (const recordingState of ['processing', 'deleted', 'none'] as const) {
      expect(canDeleteSession(row({ recordingState }))).toBe(false);
    }
  });

  it('files a row under Kept, Expiring or Expired, and nothing else under any of them', () => {
    expect(expiresFilterValue(row())).toBe('expiring');
    expect(expiresFilterValue(row({ kept: true }))).toBe('kept');
    expect(expiresFilterValue(row({ recordingState: 'expired', expiresAt: null }))).toBe('expired');
    expect(expiresFilterValue(row({ expiresAt: null }))).toBeNull();
    expect(expiresFilterValue(row({ recordingState: 'failed' }))).toBeNull();
    expect(expiresFilterValue(row({ recordingState: 'processing' }))).toBeNull();
  });

  it('greys out a row whose recording is gone', () => {
    expect(isRecordingGone(row({ recordingState: 'expired' }))).toBe(true);
    expect(isRecordingGone(row({ recordingState: 'deleted' }))).toBe(true);
    expect(isRecordingGone(row())).toBe(false);
  });

  it('counts down only on the last day, never below one hour', () => {
    const now = Date.parse('2026-12-23T16:00:00Z');
    expect(expiresSoonLabel('2026-12-24T10:00:00Z', now)).toBe('Expires in 18 hours');
    expect(expiresSoonLabel('2026-12-23T17:30:00Z', now)).toBe('Expires in 1 hour');
    expect(expiresSoonLabel('2026-12-23T15:00:00Z', now)).toBe('Expires in 1 hour');
    expect(expiresSoonLabel('2026-12-24T16:00:00Z', now)).toBeNull();
    expect(expiresSoonLabel('not a date', now)).toBeNull();
  });
});
