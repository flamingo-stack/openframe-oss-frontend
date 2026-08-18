import { describe, expect, it } from 'vitest';
import { retractedIds } from './push-retraction';

/**
 * The wire contract for clearing a banner. Both sources are best-effort by design,
 * so the parser must never let one bad half discard the other.
 */
describe('retractedIds', () => {
  it('takes the id a retraction push names directly', () => {
    expect(retractedIds({ event: 'NOTIFICATION_RETRACTED', notificationId: 'n-1' })).toEqual(['n-1']);
  });

  it('ignores notificationId on a regular push', () => {
    // Every push carries notificationId; only a retraction means "this one is dead".
    expect(retractedIds({ notificationId: 'n-1', type: 'TICKET_ASSIGNED' })).toEqual([]);
  });

  it('parses the piggybacked list that rides on every push', () => {
    expect(retractedIds({ notificationId: 'n-9', retractedIds: '["a","b"]' })).toEqual(['a', 'b']);
  });

  it('combines both sources', () => {
    const data = { event: 'NOTIFICATION_RETRACTED', notificationId: 'n-1', retractedIds: '["a"]' };
    expect(retractedIds(data)).toEqual(['n-1', 'a']);
  });

  it('keeps the directly-named id when the list is malformed', () => {
    const data = { event: 'NOTIFICATION_RETRACTED', notificationId: 'n-1', retractedIds: 'not json' };
    expect(retractedIds(data)).toEqual(['n-1']);
  });

  it('drops non-string entries and survives junk payloads', () => {
    expect(retractedIds({ retractedIds: '["a",1,null,"b"]' })).toEqual(['a', 'b']);
    expect(retractedIds({ retractedIds: '{"a":1}' })).toEqual([]);
    expect(retractedIds(undefined)).toEqual([]);
    expect(retractedIds('nonsense')).toEqual([]);
  });
});
