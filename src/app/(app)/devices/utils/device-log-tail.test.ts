import { describe, expect, it } from 'vitest';
import type { UiDeviceLog } from '../types/device-log.types';
import { BACKOFF_STEPS_MS, mergeFreshLines, pollBackoffMs } from './device-log-tail';

const line = (key: string, timestamp: string): UiDeviceLog => ({
  key,
  timestamp,
  agentTimestamp: null,
  level: 'INFO',
  rawLevel: 'INFO',
  message: key,
  hostname: null,
  count: null,
});

const T0 = '2026-09-23T10:00:00.000000000Z';
const T1 = '2026-09-23T10:00:01.000000000Z';
const T2 = '2026-09-23T10:00:02.000000000Z';

describe('pollBackoffMs', () => {
  it('walks the ladder and then holds, so a long outage never runs off the end', () => {
    expect(pollBackoffMs(0)).toBe(BACKOFF_STEPS_MS[0]);
    expect(pollBackoffMs(1)).toBe(BACKOFF_STEPS_MS[1]);
    expect(pollBackoffMs(2)).toBe(BACKOFF_STEPS_MS[1]);
    expect(pollBackoffMs(999)).toBe(BACKOFF_STEPS_MS[1]);
  });

  it('treats a negative counter as the first failure instead of indexing backwards', () => {
    expect(pollBackoffMs(-1)).toBe(BACKOFF_STEPS_MS[0]);
  });
});

describe('mergeFreshLines', () => {
  it('drops the inclusive `from` line the poll returns on every tick', () => {
    expect(mergeFreshLines([], [line('a', T0)], T0)).toBeNull();
  });

  it('prepends newer lines, newest-first', () => {
    const merged = mergeFreshLines([line('a', T0)], [line('c', T2), line('b', T1)], T0);
    expect(merged?.map(l => l.key)).toEqual(['c', 'b', 'a']);
  });

  it('drops keys already held, so a retried page does not duplicate rows', () => {
    const merged = mergeFreshLines([line('b', T1)], [line('c', T2), line('b', T1)], T0);
    expect(merged?.map(l => l.key)).toEqual(['c', 'b']);
  });

  it('is null when every line is already held — no state churn on a quiet device', () => {
    expect(mergeFreshLines([line('b', T1)], [line('b', T1)], T0)).toBeNull();
  });

  it('is null for an empty poll', () => {
    expect(mergeFreshLines([line('a', T0)], [], T0)).toBeNull();
  });

  it('keeps a line the timestamp text would sort wrongly but the nanoscale does not', () => {
    const merged = mergeFreshLines([], [line('x', '2026-09-23T10:00:00.036Z')], '2026-09-23T10:00:00.007000000Z');
    expect(merged?.map(l => l.key)).toEqual(['x']);
  });
});
