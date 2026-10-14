/**
 * The console action report: each action carries exactly the fields the
 * server accepts for it, a value the server would refuse is never sent, and
 * only a request that got no GraphQL answer is worth sending again.
 */
import { describe, expect, it, vi } from 'vitest';
import { asInstant } from '@/lib/graphql-scalars';
import { OfflineError } from '@/lib/query-state';
import { isRetryableReportError, recordRemoteSessionAction, toActionInput } from './remote-session-actions-api-service';

const relay = vi.hoisted(() => ({ commitMutation: vi.fn() }));

vi.mock('react-relay', () => ({ graphql: () => ({}), commitMutation: vi.fn() }));
vi.mock('@/lib/relay/commit-mutation', () => ({ commitMutationPromise: relay.commitMutation }));

const AT = asInstant('2026-10-13T10:00:00.000Z');
const input = (action: Parameters<typeof toActionInput>[1]) => toActionInput('session-1', action, 'event-1', AT);
const BASE = { sessionId: 'session-1', clientEventId: 'event-1', clientTime: AT };

describe('toActionInput', () => {
  it('sends input toggles and Ctrl+Alt+Del with no fields of their own', () => {
    expect(input({ action: 'INPUT_ENABLED' })).toEqual({ ...BASE, action: 'INPUT_ENABLED' });
    expect(input({ action: 'INPUT_DISABLED' })).toEqual({ ...BASE, action: 'INPUT_DISABLED' });
    expect(input({ action: 'CTRL_ALT_DEL' })).toEqual({ ...BASE, action: 'CTRL_ALT_DEL' });
  });

  it('sends a shortcut with its label and source, and drops one whose label the server would refuse', () => {
    expect(input({ action: 'SHORTCUT_SENT', label: 'Shift + Win + M', source: 'MENU' })).toEqual({
      ...BASE,
      action: 'SHORTCUT_SENT',
      label: 'Shift + Win + M',
      source: 'MENU',
    });
    expect(input({ action: 'SHORTCUT_SENT', label: 'Ctrl-W', source: 'MENU' })).toBeNull();
    expect(input({ action: 'SHORTCUT_SENT', label: 'x'.repeat(41), source: 'KEYBOARD' })).toBeNull();
  });

  it('sends a monitor switch with the target, and the source display only when it is a real monitor', () => {
    expect(input({ action: 'MONITOR_SWITCHED', toMonitorId: 2, fromMonitorId: 1, label: 'Display 2' })).toEqual({
      ...BASE,
      action: 'MONITOR_SWITCHED',
      toMonitorId: 2,
      fromMonitorId: 1,
      label: 'Display 2',
    });
    // The current display is unknown until the agent names it.
    expect(input({ action: 'MONITOR_SWITCHED', toMonitorId: 0, fromMonitorId: null })).toEqual({
      ...BASE,
      action: 'MONITOR_SWITCHED',
      toMonitorId: 0,
    });
    // 0xFFFF is the agent's combined view, not a monitor.
    expect(input({ action: 'MONITOR_SWITCHED', toMonitorId: 1, fromMonitorId: 0xffff })).not.toHaveProperty(
      'fromMonitorId',
    );
    expect(input({ action: 'MONITOR_SWITCHED', toMonitorId: 0xffff })).toBeNull();
    expect(input({ action: 'MONITOR_SWITCHED', toMonitorId: 16 })).toBeNull();
  });
});

describe('isRetryableReportError', () => {
  it('resends when the request got no answer: offline, a dropped link, a timeout, a 5xx', () => {
    expect(isRetryableReportError(new OfflineError('op'))).toBe(true);
    expect(isRetryableReportError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isRetryableReportError(new Error('Relay fetch timed out after 30000ms: op'))).toBe(true);
    expect(isRetryableReportError(new Error('Relay fetch failed: 503 Service Unavailable'))).toBe(true);
  });

  it('gives up on an answer: a 4xx or a GraphQL error', () => {
    expect(isRetryableReportError(new Error('Relay fetch failed: 400 Bad Request'))).toBe(false);
    const validation = Object.assign(new Error('No data returned'), {
      source: { errors: [{ message: 'Validation error', extensions: { code: 'ValidationError' } }] },
    });
    expect(isRetryableReportError(validation)).toBe(false);
    expect(isRetryableReportError(new Error('Validation error (WrongType)'))).toBe(false);
  });
});

describe('recordRemoteSessionAction', () => {
  it('sends the input as is and answers whether the server stored the action', async () => {
    const action = input({ action: 'CTRL_ALT_DEL' });
    if (!action) throw new Error('no input');
    relay.commitMutation.mockResolvedValueOnce({ recordRemoteSessionAction: { accepted: true, userErrors: [] } });
    await expect(recordRemoteSessionAction(action)).resolves.toBe(true);
    expect(relay.commitMutation).toHaveBeenCalledWith(expect.anything(), { input: action });

    relay.commitMutation.mockResolvedValueOnce({
      recordRemoteSessionAction: { accepted: false, userErrors: [{ code: 'REMOTE_SESSION_ENDED' }] },
    });
    await expect(recordRemoteSessionAction(action)).resolves.toBe(false);
  });
});
