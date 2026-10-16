/**
 * The table reads the session's tickets through the opened recording; assign
 * and unassign answer with the session's tickets, which replace the table; a
 * refusal reads as an error with the server's message.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  assignRecordingTickets,
  fetchRecordingTickets,
  MAX_ASSIGNED_TICKETS,
  unassignRecordingTicket,
} from './recording-tickets-api-service';

const relay = vi.hoisted(() => ({ commitMutation: vi.fn(), fetchQuery: vi.fn() }));

vi.mock('react-relay', () => ({ graphql: () => ({}), fetchQuery: relay.fetchQuery }));
vi.mock('@/lib/relay', () => ({ getRelayEnvironment: () => ({}) }));
vi.mock('relay-runtime', () => ({ readInlineData: (_fragment: unknown, ref: unknown) => ref }));
vi.mock('@/lib/relay/commit-mutation', () => ({ commitMutationPromise: relay.commitMutation }));

const LINK = {
  ticketId: '6650aa',
  ticketNumber: 3891,
  title: 'Page not found error',
  statusName: 'TODO',
  statusKind: 'CUSTOM',
  statusColor: '#2890FA',
  assignedName: 'Roman Smith',
};

describe('assignRecordingTickets', () => {
  it('sends the raw ids and resolves the session tickets from the answer', async () => {
    relay.commitMutation.mockResolvedValueOnce({
      assignRecordingTickets: { session: { tickets: [LINK] }, userErrors: [] },
    });
    await expect(assignRecordingTickets('session-1', ['6650aa'])).resolves.toEqual([
      {
        id: '6650aa',
        ticketNumber: 3891,
        title: 'Page not found error',
        statusName: 'TODO',
        statusKind: 'CUSTOM',
        statusColor: '#2890FA',
        assignedName: 'Roman Smith',
      },
    ]);
    expect(relay.commitMutation).toHaveBeenCalledWith(expect.anything(), {
      input: { sessionId: 'session-1', ticketIds: ['6650aa'] },
    });
  });

  it('throws the refusal', async () => {
    relay.commitMutation.mockResolvedValueOnce({
      assignRecordingTickets: {
        session: null,
        userErrors: [{ code: 'TICKET_NOT_FOUND', message: 'Unknown tickets: 123' }],
      },
    });
    await expect(assignRecordingTickets('session-1', ['123'])).rejects.toThrow('Unknown tickets: 123');
  });
});

describe('unassignRecordingTicket', () => {
  it('resolves what is left linked', async () => {
    relay.commitMutation.mockResolvedValueOnce({
      unassignRecordingTicket: { session: { tickets: [] }, userErrors: [] },
    });
    await expect(unassignRecordingTicket('session-1', '6650aa')).resolves.toEqual([]);
    expect(relay.commitMutation).toHaveBeenCalledWith(expect.anything(), {
      sessionId: 'session-1',
      ticketId: '6650aa',
    });
  });
});

describe('fetchRecordingTickets', () => {
  it('reads the tickets of the session the recording belongs to', async () => {
    relay.fetchQuery.mockReturnValueOnce({
      toPromise: () => Promise.resolve({ remoteSessionRecording: { session: { tickets: [LINK] } } }),
    });
    await expect(fetchRecordingTickets('rec-1')).resolves.toMatchObject([{ id: '6650aa', ticketNumber: 3891 }]);
    expect(relay.fetchQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { recordingId: 'rec-1' },
      {
        fetchPolicy: 'network-only',
      },
    );
  });

  it('reads no tickets when the answer carries none', async () => {
    relay.fetchQuery.mockReturnValueOnce({ toPromise: () => Promise.resolve(undefined) });
    await expect(fetchRecordingTickets('rec-1')).resolves.toEqual([]);
  });
});

describe('MAX_ASSIGNED_TICKETS', () => {
  it('is the server ceiling of one assign call', () => {
    expect(MAX_ASSIGNED_TICKETS).toBe(50);
  });
});
