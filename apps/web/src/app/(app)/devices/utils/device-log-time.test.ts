import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asInstant } from '@/lib/graphql-scalars';
import { deviceLogRangeBounds, groupByLocalDay } from './device-log-time';

// A zone west of UTC, so a UTC-day grouping would show the wrong day; put back so it cannot leak into the worker's next file.
const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'America/New_York';
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
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

  it('keeps a thirty-day pick within the API limit across a DST end', () => {
    // Oct 6 – Nov 4 2026 in New York: DST ends Nov 1, so the local days span 30 days and an hour.
    expect(deviceLogRangeBounds('custom', { from: new Date(2026, 9, 6), to: new Date(2026, 10, 4) }, anchor)).toEqual({
      from: '2026-10-06T04:59:59.999Z',
      to: '2026-11-05T04:59:59.999Z',
    });
  });
});

describe('groupByLocalDay', () => {
  const group = (lines: [string, string][]) =>
    groupByLocalDay(
      lines,
      ([timestamp]) => asInstant(timestamp),
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
