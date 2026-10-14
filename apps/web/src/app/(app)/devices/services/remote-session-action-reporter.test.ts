/**
 * The report queue never makes the console wait: `report` returns at once,
 * actions go out in order one at a time, a request that got no answer is sent
 * again under the same event id, and anything final is dropped.
 */
import { describe, expect, it, vi } from 'vitest';
import type { RecordRemoteSessionActionInput } from '@/__generated__/remoteSessionActionsApiServiceRecordMutation.graphql';
import { asInstant } from '@/lib/graphql-scalars';
import { RemoteSessionActionReporter, type RemoteSessionActionReporterDeps } from './remote-session-action-reporter';

vi.mock('react-relay', () => ({ graphql: () => ({}), commitMutation: vi.fn() }));

function setup(send: RemoteSessionActionReporterDeps['send']) {
  let id = 0;
  const sleeps: number[] = [];
  const deps: RemoteSessionActionReporterDeps = {
    send,
    newEventId: () => `event-${++id}`,
    now: () => asInstant('2026-10-13T10:00:00.000Z'),
    sleep: ms => {
      sleeps.push(ms);
      return Promise.resolve();
    },
  };
  return { reporter: new RemoteSessionActionReporter('session-1', deps), sleeps };
}

/** Lets the queue run every pending step. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('RemoteSessionActionReporter', () => {
  it('returns before the request answers, and sends the actions in order, one at a time', async () => {
    const sent: RecordRemoteSessionActionInput[] = [];
    let release: () => void = () => {};
    const send = vi.fn((input: RecordRemoteSessionActionInput) => {
      sent.push(input);
      return new Promise<void>(resolve => {
        release = resolve;
      });
    });
    const { reporter } = setup(send);

    reporter.report({ action: 'INPUT_DISABLED' });
    reporter.report({ action: 'CTRL_ALT_DEL' });
    expect(sent.map(input => input.action)).toEqual(['INPUT_DISABLED']);

    release();
    await settle();
    expect(sent.map(input => [input.action, input.clientEventId])).toEqual([
      ['INPUT_DISABLED', 'event-1'],
      ['CTRL_ALT_DEL', 'event-2'],
    ]);
  });

  it('sends an unanswered action again under the same event id, then gives up after three resends', async () => {
    const send = vi.fn<RemoteSessionActionReporterDeps['send']>().mockRejectedValue(new TypeError('Failed to fetch'));
    const { reporter, sleeps } = setup(send);

    reporter.report({ action: 'INPUT_ENABLED' });
    await settle();

    expect(send).toHaveBeenCalledTimes(4);
    expect(new Set(send.mock.calls.map(([input]) => input.clientEventId))).toEqual(new Set(['event-1']));
    expect(sleeps).toEqual([1_000, 3_000, 10_000]);
  });

  it('drops an action the server answered with an error and goes on with the next', async () => {
    const send = vi
      .fn<RemoteSessionActionReporterDeps['send']>()
      .mockRejectedValueOnce(new Error('Validation error (WrongType)'))
      .mockResolvedValueOnce(true);
    const { reporter, sleeps } = setup(send);

    reporter.report({ action: 'INPUT_DISABLED' });
    reporter.report({ action: 'INPUT_ENABLED' });
    await settle();

    expect(send.mock.calls.map(([input]) => input.action)).toEqual(['INPUT_DISABLED', 'INPUT_ENABLED']);
    expect(sleeps).toEqual([]);
  });

  it('never sends an action the server would refuse', async () => {
    const send = vi.fn<RemoteSessionActionReporterDeps['send']>().mockResolvedValue(true);
    const { reporter } = setup(send);

    reporter.report({ action: 'SHORTCUT_SENT', label: 'Ctrl-W', source: 'MENU' });
    await settle();

    expect(send).not.toHaveBeenCalled();
  });
});
