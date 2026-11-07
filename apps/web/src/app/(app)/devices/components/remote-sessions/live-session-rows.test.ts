/**
 * How the Remote Sessions lists combine the polled running sessions with the
 * pages they loaded: one row per session, the running ones first in the poll's
 * order, and which rows the poll says have ended.
 */
import { describe, expect, it } from 'vitest';
import { endedLiveRows, uniqueSessions, withPolledLiveRows } from './live-session-rows';

const row = (id: string, live = false, version = 'page') => ({ id, live, version });

describe('uniqueSessions', () => {
  it('keeps the first copy of a session and the order of the rest', () => {
    const rows = [row('a', true), row('b'), row('a', false, 'later page'), row('c')];
    expect(uniqueSessions(rows)).toEqual([row('a', true), row('b'), row('c')]);
  });
});

describe('withPolledLiveRows', () => {
  it('shows the list as it came until the poll answers, one row per session', () => {
    expect(withPolledLiveRows([row('a', true), row('b'), row('b')], null)).toEqual([row('a', true), row('b')]);
  });

  it("leads with the poll's running sessions in its order, then the list without them", () => {
    const page = [row('a', true), row('b'), row('c')];
    const polled = [row('new', true, 'poll'), row('a', true, 'poll')];
    expect(withPolledLiveRows(page, polled)).toEqual([
      row('new', true, 'poll'),
      row('a', true, 'poll'),
      row('b'),
      row('c'),
    ]);
  });

  it('keeps a row the poll no longer returns where the list has it, until the list reads it again', () => {
    expect(withPolledLiveRows([row('a', true), row('b')], [])).toEqual([row('a', true), row('b')]);
  });
});

describe('endedLiveRows', () => {
  it('names the rows the list shows running that the poll no longer returns', () => {
    const page = [row('a', true), row('b', true), row('c')];
    expect(endedLiveRows(page, [row('b', true)])).toEqual(['a']);
  });

  it('names none while every running row is still polled, or the list shows none running', () => {
    expect(endedLiveRows([row('a', true), row('c')], [row('a', true), row('new', true)])).toEqual([]);
    expect(endedLiveRows([row('c')], [])).toEqual([]);
  });
});
