import { describe, expect, it } from 'vitest';
import { parseRetractedIds } from './push-retraction';

/**
 * The wire contract for clearing a banner. Both sources are best-effort by design,
 * so the parser must never let one bad half discard the other.
 */
describe('parseRetractedIds', () => {
  it('takes the id a retraction push names directly', () => {
    expect(parseRetractedIds({ event: 'NOTIFICATION_RETRACTED', notificationId: 'n-1' })).toEqual(['n-1']);
  });

  it('ignores notificationId on a regular push', () => {
    // Every push carries notificationId; only a retraction means "this one is dead".
    expect(parseRetractedIds({ notificationId: 'n-1', type: 'TICKET_ASSIGNED' })).toEqual([]);
  });

  it('parses the piggybacked list that rides on every push', () => {
    expect(parseRetractedIds({ notificationId: 'n-9', retractedIds: '["a","b"]' })).toEqual(['a', 'b']);
  });

  it('combines both sources', () => {
    const data = { event: 'NOTIFICATION_RETRACTED', notificationId: 'n-1', retractedIds: '["a"]' };
    expect(parseRetractedIds(data)).toEqual(['n-1', 'a']);
  });

  it('keeps the directly-named id when the list is malformed', () => {
    const data = { event: 'NOTIFICATION_RETRACTED', notificationId: 'n-1', retractedIds: 'not json' };
    expect(parseRetractedIds(data)).toEqual(['n-1']);
  });

  it('drops non-string entries and survives junk payloads', () => {
    expect(parseRetractedIds({ retractedIds: '["a",1,null,"b"]' })).toEqual(['a', 'b']);
    expect(parseRetractedIds({ retractedIds: '{"a":1}' })).toEqual([]);
    expect(parseRetractedIds(undefined)).toEqual([]);
    expect(parseRetractedIds('nonsense')).toEqual([]);
  });
});
