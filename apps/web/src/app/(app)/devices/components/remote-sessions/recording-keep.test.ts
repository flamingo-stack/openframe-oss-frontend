import { describe, expect, it } from 'vitest';
import { formatDate } from '@/lib/format-date';
import { formatBytes } from './format';
import { keepReasonText, keptUsageText, releaseDueOn } from './recording-keep';

describe('recording keep text', () => {
  it('reads the reason by its label, and an "Other" Keep by its note', () => {
    expect(keepReasonText({ reason: 'CLIENT_DISPUTE', note: null })).toBe('Client dispute');
    expect(keepReasonText({ reason: 'LEGAL_OR_COMPLIANCE', note: null })).toBe('Legal or compliance request');
    expect(keepReasonText({ reason: 'OTHER', note: 'Customer asked to keep it' })).toBe('Customer asked to keep it');
    expect(keepReasonText({ reason: 'OTHER', note: null })).toBe('Other');
  });

  it('names the original expiry only when releasing adds the grace period', () => {
    expect(releaseDueOn({ dueAt: '2026-10-08T10:00:00Z', expiresAtOnRelease: '2026-10-12T10:00:00Z' })).toBe(
      formatDate('2026-10-08T10:00:00Z'),
    );
    expect(releaseDueOn({ dueAt: '2026-12-24T10:00:00Z', expiresAtOnRelease: '2026-12-24T10:00:00Z' })).toBeNull();
    expect(releaseDueOn({ dueAt: null, expiresAtOnRelease: '2026-12-24T10:00:00Z' })).toBeNull();
  });

  it('writes the kept usage as "X of Y" from the storage, whole numbers without a decimal', () => {
    const storage = {
      usedBytes: 0,
      limitBytes: 0,
      keptBytes: 612 * 1024 ** 2,
      keptLimitBytes: 50 * 1024 ** 3,
      full: false,
    };
    expect(keptUsageText(storage)).toBe('612 MB of 50 GB');
    expect(keptUsageText(undefined)).toBe('their own allowance');
    expect(formatBytes(2_454_931)).toBe('2.3 MB');
  });
});
