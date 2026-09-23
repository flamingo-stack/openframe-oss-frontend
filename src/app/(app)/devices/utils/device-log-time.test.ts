import { describe, expect, it } from 'vitest';
import {
  deviceLogDay,
  deviceLogDayBounds,
  formatDeviceLogDay,
  formatDeviceLogTime,
  instantToNanos,
  isInstantAfter,
  isRangeWithinLimit,
  presetToFromInstant,
} from './device-log-time';

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

describe('range presets', () => {
  it('computes the lower bound from a fixed clock', () => {
    const now = new Date('2026-09-21T12:00:00.000Z');
    expect(presetToFromInstant('1h', now)).toBe('2026-09-21T11:00:00.000Z');
    expect(presetToFromInstant('24h', now)).toBe('2026-09-20T12:00:00.000Z');
    expect(presetToFromInstant('7d', now)).toBe('2026-09-14T12:00:00.000Z');
  });

  it('caps custom ranges at 30 days inclusive', () => {
    const to = new Date('2026-09-21T23:59:59.999Z');
    expect(isRangeWithinLimit(new Date('2026-08-22T23:59:59.999Z'), to)).toBe(true);
    expect(isRangeWithinLimit(new Date('2026-08-22T00:00:00.000Z'), to)).toBe(false);
  });
});

describe('row time and day', () => {
  it('pads every fraction to nanoseconds so the column is not ragged', () => {
    // The API trims to 3, 6 or 9 digits, which left stamps of three lengths
    // stacked in one fixed-width column.
    expect(formatDeviceLogTime('2026-09-23T09:04:26.847000044Z')).toBe('09:04:26.847000044');
    expect(formatDeviceLogTime('2026-09-23T09:04:26.847Z')).toBe('09:04:26.847000000');
    expect(formatDeviceLogTime('2026-09-23T09:04:26.847000Z')).toBe('09:04:26.847000000');
    expect(formatDeviceLogTime('2026-09-23T09:04:26Z')).toBe('09:04:26.000000000');
  });

  it('gives every stamp the same width', () => {
    const widths = ['2026-09-23T09:04:26Z', '2026-09-23T09:04:26.847Z', '2026-09-23T09:04:26.847000044Z'].map(
      instant => formatDeviceLogTime(instant).length,
    );
    expect(new Set(widths).size).toBe(1);
  });

  it('keeps two lines inside one millisecond distinguishable', () => {
    // Why the column shows the whole fraction: agents burst several lines into
    // the same millisecond, and a truncated stamp made them look identical.
    expect(formatDeviceLogTime('2026-09-23T12:04:35.731000019Z')).not.toBe(
      formatDeviceLogTime('2026-09-23T12:04:35.731000018Z'),
    );
  });

  it('passes an unrecognised timestamp through instead of losing it', () => {
    expect(formatDeviceLogTime('yesterday')).toBe('yesterday');
    expect(formatDeviceLogDay('yesterday')).toBe('yesterday');
  });

  it('groups by UTC day and labels the separator', () => {
    expect(deviceLogDay('2026-09-23T09:04:26.847000044Z')).toBe('2026-09-23');
    expect(formatDeviceLogDay('2026-09-23T00:00:00Z')).toBe('23 SEP 2026');
    expect(formatDeviceLogDay('2026-01-05T23:59:59Z')).toBe('05 JAN 2026');
  });
});

describe('deviceLogDayBounds', () => {
  it('covers whole UTC days, so the filter matches the day the rows are grouped under', () => {
    expect(deviceLogDayBounds('2026-09-23', '2026-09-23')).toEqual({
      from: '2026-09-23T00:00:00.000Z',
      to: '2026-09-23T23:59:59.999Z',
    });
    expect(deviceLogDayBounds('2026-09-20', '2026-09-23').to).toBe('2026-09-23T23:59:59.999Z');
  });

  it('treats a single picked day as that whole day', () => {
    expect(deviceLogDayBounds('2026-09-23', '')).toEqual({
      from: '2026-09-23T00:00:00.000Z',
      to: '2026-09-23T23:59:59.999Z',
    });
  });

  it('is empty when nothing is picked', () => {
    expect(deviceLogDayBounds('', '')).toEqual({ from: undefined, to: undefined });
  });

  it('treats a lone end day as that whole day, the way a lone start day is treated', () => {
    // A URL carrying only `logTo` used to drop the range and land on the
    // default window without telling anyone.
    expect(deviceLogDayBounds('', '2026-09-23')).toEqual({
      from: '2026-09-23T00:00:00.000Z',
      to: '2026-09-23T23:59:59.999Z',
    });
  });

  it('clamps a hand-edited URL to the API limit instead of sending a doomed request', () => {
    const wide = deviceLogDayBounds('2026-01-01', '2026-09-23');
    expect(wide.to).toBe('2026-09-23T23:59:59.999Z');
    expect(wide.from).toBe('2026-08-25T00:00:00.000Z');
    expect(isRangeWithinLimit(new Date(wide.from as string), new Date(wide.to as string))).toBe(true);
  });

  it('leaves a range inside the limit untouched', () => {
    expect(deviceLogDayBounds('2026-09-20', '2026-09-23').from).toBe('2026-09-20T00:00:00.000Z');
  });
});
