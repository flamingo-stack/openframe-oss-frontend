import { describe, expect, it } from 'vitest';
import type { RecordingSummary } from '../../types/session-recording';
import {
  canDeleteSession,
  canOpenSession,
  expiresFilterValue,
  EXPIRING_WINDOW_MS,
  expiresSoonLabel,
  isRecordingGone,
  recordingUnavailableNote,
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

  it('files a row under Kept, Expiring (within a week) or Expired, and nothing else under any of them', () => {
    const expiry = Date.parse('2026-12-24T10:00:00Z');
    const inSixDays = expiry - 6 * 24 * 60 * 60 * 1000;
    const inEightDays = expiry - 8 * 24 * 60 * 60 * 1000;
    expect(expiresFilterValue(row(), inSixDays)).toBe('expiring');
    expect(expiresFilterValue(row(), expiry - EXPIRING_WINDOW_MS)).toBeNull();
    expect(expiresFilterValue(row(), inEightDays)).toBeNull();
    expect(expiresFilterValue(row({ kept: true }), inEightDays)).toBe('kept');
    expect(expiresFilterValue(row({ recordingState: 'expired', expiresAt: null }), inSixDays)).toBe('expired');
    expect(expiresFilterValue(row({ expiresAt: null }), inSixDays)).toBeNull();
    expect(expiresFilterValue(row({ recordingState: 'failed' }), inSixDays)).toBeNull();
    expect(expiresFilterValue(row({ recordingState: 'processing' }), inSixDays)).toBeNull();
  });

  it('greys out a row whose recording is gone', () => {
    expect(isRecordingGone(row({ recordingState: 'expired' }))).toBe(true);
    expect(isRecordingGone(row({ recordingState: 'deleted' }))).toBe(true);
    expect(isRecordingGone(row())).toBe(false);
  });

  it('says a gone recording was deleted or expired, and processing only when its files could not be fetched', () => {
    expect(recordingUnavailableNote(row({ recordingState: 'deleted' }), true)).toBe('This recording was deleted');
    expect(recordingUnavailableNote(row({ recordingState: 'expired' }), false)).toBe('This recording has expired');
    expect(recordingUnavailableNote(row(), true)).toContain('still being processed');
    expect(recordingUnavailableNote(row(), false)).toBeNull();
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
