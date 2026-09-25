// The tab shows local wall-clock time while the wire carries UTC instants with
// up to nine fraction digits. Pinned in a zone west of UTC with DST, where a
// UTC-day or millisecond shortcut shows the wrong day, hour or line order.
import { describe, expect, it } from 'vitest';
import {
  adoptRefreshStamp,
  deviceLogCustomBounds,
  deviceLogDay,
  formatDeviceLogDay,
  formatDeviceLogTime,
  groupDeviceLogDays,
  instantToNanos,
  isInstantAfter,
  presetToFromInstant,
} from './device-log-time';

// Before any test runs; Node re-reads the zone on assignment.
process.env.TZ = 'America/New_York';

const local = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('instantToNanos', () => {
  it('reads 3, 6 and 9 fraction digits onto one nanosecond scale', () => {
    expect(instantToNanos('2026-09-18T19:08:46.129Z')).toBe(BigInt('1789758526129000000'));
    expect(instantToNanos('2026-09-18T19:08:46.129000Z')).toBe(BigInt('1789758526129000000'));
    expect(instantToNanos('2026-09-18T19:08:46.129000035Z')).toBe(BigInt('1789758526129000035'));
    expect(instantToNanos('2026-09-18T19:08:46Z')).toBe(BigInt('1789758526000000000'));
  });

  it('orders by value where the text order lies', () => {
    // As text "…486Z" sorts AFTER "…486000035Z" ('Z' > '0'), yet it is 35 ns earlier.
    expect('2026-09-18T19:08:46.486Z' > '2026-09-18T19:08:46.486000035Z').toBe(true);
    expect(instantToNanos('2026-09-18T19:08:46.486Z') < instantToNanos('2026-09-18T19:08:46.486000035Z')).toBe(true);
  });

  it('rejects what is not an instant', () => {
    expect(() => instantToNanos('yesterday')).toThrow(/Unexpected timestamp/);
    expect(() => instantToNanos('2026-09-18T19:08:46.129+02:00')).toThrow(/Unexpected timestamp/);
  });
});

describe('isInstantAfter', () => {
  it('is strict, so the inclusive `from` line is dropped from a poll', () => {
    expect(isInstantAfter('2026-09-18T19:08:46.129Z', '2026-09-18T19:08:46.129000000Z')).toBe(false);
    expect(isInstantAfter('2026-09-18T19:08:46.129000001Z', '2026-09-18T19:08:46.129Z')).toBe(true);
  });

  it('falls back to a text comparison for a shape it does not know', () => {
    expect(isInstantAfter('b', 'a')).toBe(true);
  });
});

describe('presetToFromInstant', () => {
  it('computes the lower bound from a fixed clock', () => {
    const now = new Date('2026-09-21T12:00:00.000Z');
    expect(presetToFromInstant('1h', now)).toBe('2026-09-21T11:00:00.000Z');
    expect(presetToFromInstant('24h', now)).toBe('2026-09-20T12:00:00.000Z');
    expect(presetToFromInstant('7d', now)).toBe('2026-09-14T12:00:00.000Z');
  });
});

describe('row time', () => {
  it('shows the local wall clock, not the UTC digits', () => {
    // 09:04 UTC is 05:04 in New York (EDT, UTC−4).
    expect(formatDeviceLogTime('2026-09-23T09:04:26.847000044Z')).toBe('05:04:26.847000044');
  });

  it('follows DST: the same UTC hour is an hour apart across the switch', () => {
    expect(formatDeviceLogTime('2026-01-15T12:00:00Z')).toBe('07:00:00.000000000');
    expect(formatDeviceLogTime('2026-07-15T12:00:00Z')).toBe('08:00:00.000000000');
  });

  it('pads every fraction to nanoseconds so the column is not ragged', () => {
    const widths = ['2026-09-23T09:04:26Z', '2026-09-23T09:04:26.847Z', '2026-09-23T09:04:26.847000044Z'].map(
      instant => formatDeviceLogTime(instant).length,
    );
    expect(new Set(widths).size).toBe(1);
    expect(formatDeviceLogTime('2026-09-23T09:04:26.847Z')).toBe('05:04:26.847000000');
  });

  it('keeps two lines inside one millisecond distinguishable', () => {
    // Agents burst several lines into one millisecond; `Date` alone would print them identically.
    expect(formatDeviceLogTime('2026-09-23T12:04:35.731000019Z')).not.toBe(
      formatDeviceLogTime('2026-09-23T12:04:35.731000018Z'),
    );
  });

  it('passes an unrecognised timestamp through instead of losing it', () => {
    expect(formatDeviceLogTime('yesterday')).toBe('yesterday');
    expect(formatDeviceLogDay('yesterday')).toBe('yesterday');
  });
});

describe('day separators', () => {
  it('groups by the LOCAL day: just after UTC midnight is still yesterday here', () => {
    expect(deviceLogDay('2026-09-24T02:30:00Z')).toBe('2026-09-23');
    expect(deviceLogDay('2026-09-24T04:30:00Z')).toBe('2026-09-24');
    expect(formatDeviceLogDay('2026-09-24T02:30:00Z')).toBe('23 SEP 2026');
  });
});

describe('groupDeviceLogDays', () => {
  const keys = (stamps: string[]) => groupDeviceLogDays(stamps, stamp => stamp).map(group => group.key);

  it('splits newest-first lines into runs per local day, labelled', () => {
    const groups = groupDeviceLogDays(['2026-09-24T12:00:00Z', '2026-09-24T05:00:00Z', '2026-09-24T02:30:00Z'], s => s);
    expect(groups.map(group => [group.key, group.label, group.items.length])).toEqual([
      ['2026-09-24', '24 SEP 2026', 2],
      ['2026-09-23', '23 SEP 2026', 1],
    ]);
  });

  it('keeps every key when the live tail prepends a line of the same day', () => {
    const before = keys(['2026-09-24T12:00:00Z', '2026-09-23T12:00:00Z']);
    expect(keys(['2026-09-24T12:00:05Z', '2026-09-24T12:00:00Z', '2026-09-23T12:00:00Z'])).toEqual(before);
  });

  it('keeps every key when an older page is appended', () => {
    const before = keys(['2026-09-24T12:00:00Z', '2026-09-23T12:00:00Z']);
    expect(
      keys(['2026-09-24T12:00:00Z', '2026-09-23T12:00:00Z', '2026-09-23T08:00:00Z', '2026-09-22T12:00:00Z']),
    ).toEqual([...before, '2026-09-22']);
  });

  it('keys a day that recurs after an unparseable stamp apart from its first run', () => {
    expect(keys(['2026-09-24T12:00:00Z', 'garbage', '2026-09-24T11:00:00Z'])).toEqual([
      '2026-09-24',
      'garbage'.slice(0, 10),
      '2026-09-24#1',
    ]);
  });
});

describe('deviceLogCustomBounds', () => {
  it('covers the picked local days, inclusive, as instants', () => {
    expect(deviceLogCustomBounds({ from: local(2026, 9, 20), to: local(2026, 9, 23) })).toEqual({
      from: '2026-09-20T04:00:00.000Z',
      to: '2026-09-24T03:59:59.999Z',
    });
  });

  it('treats a lone day — start or end — as that whole day', () => {
    const day = { from: '2026-09-23T04:00:00.000Z', to: '2026-09-24T03:59:59.999Z' };
    expect(deviceLogCustomBounds({ from: local(2026, 9, 23), to: undefined })).toEqual(day);
    expect(deviceLogCustomBounds({ from: undefined, to: local(2026, 9, 23) })).toEqual(day);
  });

  it('puts a hand-edited reversed pair in order instead of sending an empty range', () => {
    expect(deviceLogCustomBounds({ from: local(2026, 9, 23), to: local(2026, 9, 20) })).toEqual(
      deviceLogCustomBounds({ from: local(2026, 9, 20), to: local(2026, 9, 23) }),
    );
  });

  it('clamps a hand-edited range to the API limit of 30 days, day-aligned', () => {
    const wide = deviceLogCustomBounds({ from: local(2026, 1, 1), to: local(2026, 9, 23) });
    expect(wide.from).toBe('2026-08-25T04:00:00.000Z');
    expect(wide.to).toBe('2026-09-24T03:59:59.999Z');
  });

  it('is empty when nothing is picked', () => {
    expect(deviceLogCustomBounds(undefined)).toEqual({});
    expect(deviceLogCustomBounds({ from: undefined, to: undefined })).toEqual({});
  });
});

describe('adoptRefreshStamp', () => {
  const anchor = Date.UTC(2026, 8, 24, 12);

  it('moves the window to a newer stamp — the Run Script jump', () => {
    expect(adoptRefreshStamp(String(anchor + 5_000), anchor)).toBe(anchor + 5_000);
  });

  it('ignores an older stamp, so Back to an earlier jump reloads nothing', () => {
    expect(adoptRefreshStamp(String(anchor - 5_000), anchor)).toBeNull();
    expect(adoptRefreshStamp(String(anchor), anchor)).toBeNull();
  });

  it('rejects what `Date` cannot represent, where every format would throw', () => {
    expect(adoptRefreshStamp('8640000000000001', anchor)).toBeNull();
    expect(adoptRefreshStamp('Infinity', anchor)).toBeNull();
  });

  it('rejects an empty or hand-edited non-number stamp', () => {
    expect(adoptRefreshStamp('', anchor)).toBeNull();
    expect(adoptRefreshStamp('yesterday', anchor)).toBeNull();
  });
});
