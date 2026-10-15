import { describe, expect, it } from 'vitest';
import { historyPage, persistedRows, publishTurn } from '../__tests__/chat-fixtures';
import { FakeJetStream } from '../__tests__/fake-jetstream';
import { historyStreamFloor } from './history-stream-floor';

function turn(i: number) {
  return publishTurn(new FakeJetStream(), i);
}

describe('historyStreamFloor', () => {
  it('resumes after the newest stamped row', () => {
    const t = turn(0);
    expect(historyStreamFloor([historyPage(persistedRows(t, 0, true, Date.now()))])).toBe(t.seqs.lastContent);
  });

  it('replays from the stream start when history holds no assistant row (a first answer still streaming)', () => {
    const [userRow] = persistedRows(turn(0), 0, true, Date.now());
    expect(historyStreamFloor([historyPage([userRow])])).toBe(0);
    expect(historyStreamFloor(undefined)).toBe(0);
  });

  it('live-tails when assistant rows carry no stamp', () => {
    expect(historyStreamFloor([historyPage(persistedRows(turn(0), 0, false, Date.now()))])).toBeNull();
  });
});
