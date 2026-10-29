import { describe, expect, it } from 'vitest';
import type { RecordingSummary } from '../../types/session-recording';
import {
  canDeleteSession,
  canKeepSession,
  canOpenSession,
  expiresFilterValue,
  EXPIRING_WINDOW_MS,
  expiresSoonLabel,
  isLiveRow,
  isRecordingGone,
  sessionHref,
} from './session-status';

type Row = Pick<RecordingSummary, 'recordingState' | 'live' | 'kept' | 'expiresAt' | 'recordingId'>;

const row = (overrides: Partial<Row> = {}): Row => ({
  recordingState: 'ready',
  live: false,
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

  it('offers Keep only for a playable recording that is not kept yet', () => {
    expect(canKeepSession(row())).toBe(true);
    expect(canKeepSession(row({ kept: true }))).toBe(false);
    for (const recordingState of ['processing', 'failed', 'expired', 'deleted', 'none'] as const) {
      expect(canKeepSession(row({ recordingState }))).toBe(false);
    }
  });

  it('deletes any ended session, never a live, processing or kept one', () => {
    for (const recordingState of ['ready', 'failed', 'expired', 'deleted', 'none'] as const) {
      expect(canDeleteSession(row({ recordingState, recordingId: null }))).toBe(true);
    }
    expect(canDeleteSession(row({ recordingState: 'processing' }))).toBe(false);
    expect(canDeleteSession(row({ kept: true }))).toBe(false);
    expect(canDeleteSession(row({ recordingState: 'none', live: true }))).toBe(false);
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

  it('counts down only on the last day, never below one hour', () => {
    const now = Date.parse('2026-12-23T16:00:00Z');
    expect(expiresSoonLabel('2026-12-24T10:00:00Z', now)).toBe('Expires in 18 hours');
    expect(expiresSoonLabel('2026-12-23T17:30:00Z', now)).toBe('Expires in 1 hour');
    expect(expiresSoonLabel('2026-12-23T15:00:00Z', now)).toBe('Expires in 1 hour');
    expect(expiresSoonLabel('2026-12-24T16:00:00Z', now)).toBeNull();
    expect(expiresSoonLabel('not a date', now)).toBeNull();
  });
});

describe('session row target', () => {
  const OWN = { userId: 'tech-roman', remoteControl: true };
  const target = (overrides: Partial<RecordingSummary> = {}) => ({
    ...row(),
    deviceId: 'machine-1',
    technicianId: 'tech-roman',
    ...overrides,
  });
  const running = { live: true, recordingState: 'processing', recordingId: null } as const;

  it('reads a running session LIVE only while Watch live is on', () => {
    expect(isLiveRow({ live: true }, OWN)).toBe(true);
    expect(isLiveRow({ live: true }, null)).toBe(false);
    expect(isLiveRow({ live: false }, OWN)).toBe(false);
  });

  it('opens a finished session on its recording, whatever Watch live says', () => {
    expect(sessionHref(target(), null)).toBe('/devices/details/remote-session?id=rec-1');
    expect(sessionHref(target(), OWN)).toBe('/devices/details/remote-session?id=rec-1');
    expect(sessionHref(target({ recordingState: 'failed' }), OWN)).toBeNull();
  });

  it("opens Remote Control from the technician's own running session, and nothing from anyone else's", () => {
    expect(sessionHref(target(running), OWN)).toBe('/devices/details/remote-desktop?id=machine-1');
    expect(sessionHref(target({ ...running, technicianId: 'tech-dana' }), OWN)).toBeNull();
    expect(sessionHref(target(running), { userId: null, remoteControl: true })).toBeNull();
    expect(sessionHref(target(running), { ...OWN, remoteControl: false })).toBeNull();
  });

  it('opens nothing from a running session while Watch live is off', () => {
    expect(sessionHref(target(running), null)).toBeNull();
  });
});
