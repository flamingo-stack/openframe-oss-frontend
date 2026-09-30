import { describe, expect, it } from 'vitest';
import { deviceLogRangeBounds, groupByLocalDay, instantToDate } from './device-log-time';

// A zone west of UTC, so a UTC-day grouping would show the wrong day.
process.env.TZ = 'America/New_York';

describe('instantToDate', () => {
  it('reads the nanosecond fractions Java prints', () => {
    expect(instantToDate('2026-09-23T09:04:26.847000044Z')?.toISOString()).toBe('2026-09-23T09:04:26.847Z');
    expect(instantToDate('2026-09-23T09:04:26Z')?.toISOString()).toBe('2026-09-23T09:04:26.000Z');
    expect(instantToDate('yesterday')).toBeNull();
  });
});

describe('deviceLogRangeBounds', () => {
  const anchor = Date.parse('2026-09-21T12:00:00.000Z');

  it('counts a preset back from the anchor, and the default preset for a custom range with no days picked', () => {
    expect(deviceLogRangeBounds('1h', undefined, anchor)).toEqual({ from: '2026-09-21T11:00:00.000Z' });
    expect(deviceLogRangeBounds('7d', undefined, anchor)).toEqual({ from: '2026-09-14T12:00:00.000Z' });
    expect(deviceLogRangeBounds('custom', undefined, anchor)).toEqual({ from: '2026-09-20T12:00:00.000Z' });
  });

  it('covers the picked local days inclusively', () => {
    expect(deviceLogRangeBounds('custom', { from: new Date(2026, 8, 20), to: new Date(2026, 8, 23) }, anchor)).toEqual({
      from: '2026-09-20T04:00:00.000Z',
      to: '2026-09-24T03:59:59.999Z',
    });
  });
});

describe('groupByLocalDay', () => {
  const group = (lines: [string, string][]) =>
    groupByLocalDay(
      lines,
      ([timestamp]) => timestamp,
      ([, cursor]) => cursor,
    );

  it('splits newest-first lines by the local day', () => {
    // 02:30 UTC on the 24th is still the 23rd in New York.
    const groups = group([
      ['2026-09-24T12:00:00Z', 'c'],
      ['2026-09-24T02:30:00Z', 'b'],
      ['2026-09-23T12:00:00Z', 'a'],
    ]);
    expect(groups.map(day => [day.key, day.rows.map(row => row.key)])).toEqual([
      ['2026-09-24', ['c']],
      ['2026-09-23', ['b', 'a']],
    ]);
  });

  it('keeps row keys unique when lines share a cursor', () => {
    const [day] = group([
      ['2026-09-24T12:00:00Z', 'same'],
      ['2026-09-24T12:00:00Z', 'same'],
    ]);
    expect(day.rows.map(row => row.key)).toEqual(['same', 'same#1']);
  });
});
