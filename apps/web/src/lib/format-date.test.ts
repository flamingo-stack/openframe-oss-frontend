import { describe, expect, it } from 'vitest';
import { EMPTY_VALUE } from './empty-value';
import {
  formatDateTime,
  formatDateTimeInZone,
  formatDateTimeOnDevice,
  formatTimeZone,
  toDateTimeLocalValue,
  viewerTimeZone,
} from './format-date';

const SUMMER = '2026-06-26T11:22:00Z';
const WINTER = '2026-01-15T11:22:00Z';

describe('formatTimeZone', () => {
  it('labels a zone with the offset it had at that moment, not a fixed one', () => {
    expect(formatTimeZone('Europe/Kyiv', SUMMER)).toBe('(UTC+03:00) Kyiv');
    expect(formatTimeZone('Europe/Kyiv', WINTER)).toBe('(UTC+02:00) Kyiv');
  });

  it('reads the city off the last segment of the id', () => {
    expect(formatTimeZone('America/Argentina/Buenos_Aires', SUMMER)).toBe('(UTC-03:00) Buenos Aires');
    expect(formatTimeZone('Asia/Kolkata', SUMMER)).toBe('(UTC+05:30) Kolkata');
  });

  it('spells a renamed city the current way, whichever id it arrives under', () => {
    expect(formatTimeZone('Europe/Kiev', SUMMER)).toBe('(UTC+03:00) Kyiv');
    expect(formatTimeZone('Asia/Calcutta', SUMMER)).toBe('(UTC+05:30) Kolkata');
  });

  it('shows the offset alone for the ids that name no place', () => {
    expect(formatTimeZone('UTC', SUMMER)).toBe('(UTC+00:00)');
    expect(formatTimeZone('Etc/GMT+5', SUMMER)).toBe('(UTC-05:00)');
  });

  it('is empty for a missing zone and for one the runtime does not know', () => {
    expect(formatTimeZone(null, SUMMER)).toBe(EMPTY_VALUE);
    expect(formatTimeZone('', SUMMER)).toBe(EMPTY_VALUE);
    expect(formatTimeZone('Mars/Olympus_Mons', SUMMER)).toBe(EMPTY_VALUE);
  });
});

describe('formatDateTimeInZone', () => {
  it("matches formatDateTime on the viewer's own zone", () => {
    expect(formatDateTimeInZone(SUMMER, viewerTimeZone())).toBe(formatDateTime(SUMMER));
  });

  it('reads the same instant on the clock of the zone it is given', () => {
    const tokyo = formatDateTimeInZone(SUMMER, 'Asia/Tokyo');
    const newYork = formatDateTimeInZone(SUMMER, 'America/New_York');
    expect(tokyo).not.toBe(newYork);
    expect(tokyo).toBe(formatDateTimeInZone('2026-06-26T20:22:00+09:00', 'Asia/Tokyo'));
  });

  it('is empty without an instant, without a zone, and for an unknown zone', () => {
    expect(formatDateTimeInZone(null, 'Asia/Tokyo')).toBe(EMPTY_VALUE);
    expect(formatDateTimeInZone(SUMMER, null)).toBe(EMPTY_VALUE);
    expect(formatDateTimeInZone(SUMMER, 'Mars/Olympus_Mons')).toBe(EMPTY_VALUE);
  });
});

describe('formatDateTimeOnDevice', () => {
  it("reads on the device's clock and names the zone after the time", () => {
    const zoneName = new Intl.DateTimeFormat(undefined, { timeZone: 'Australia/Sydney', timeZoneName: 'short' })
      .formatToParts(new Date(SUMMER))
      .find(part => part.type === 'timeZoneName')?.value;
    expect(zoneName).toBeTruthy();
    expect(formatDateTimeOnDevice(SUMMER, 'Australia/Sydney')).toBe(
      `${formatDateTimeInZone(SUMMER, 'Australia/Sydney')} ${zoneName}`,
    );
  });

  it("falls back to the viewer's clock, unlabelled, when the device zone is unknown", () => {
    expect(formatDateTimeOnDevice(SUMMER, null)).toBe(formatDateTime(SUMMER));
    expect(formatDateTimeOnDevice(SUMMER, '')).toBe(formatDateTime(SUMMER));
    expect(formatDateTimeOnDevice(SUMMER, 'Mars/Olympus_Mons')).toBe(formatDateTime(SUMMER));
  });

  it('is empty without an instant', () => {
    expect(formatDateTimeOnDevice(null, 'Australia/Sydney')).toBe(EMPTY_VALUE);
    expect(formatDateTimeOnDevice('junk', 'Australia/Sydney')).toBe(EMPTY_VALUE);
  });
});

describe('toDateTimeLocalValue', () => {
  it("is the viewer's wall clock in the datetime-local shape, not the UTC clock", () => {
    const date = new Date(SUMMER);
    const pad = (n: number) => String(n).padStart(2, '0');
    const expected = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    expect(toDateTimeLocalValue(SUMMER)).toBe(expected);
    // The field parses its value as local time, so the pair round-trips.
    expect(new Date(toDateTimeLocalValue(SUMMER)).getTime()).toBe(Date.parse(SUMMER));
  });

  it('is empty for a missing or unparseable instant', () => {
    expect(toDateTimeLocalValue(null)).toBe('');
    expect(toDateTimeLocalValue('junk')).toBe('');
  });
});
