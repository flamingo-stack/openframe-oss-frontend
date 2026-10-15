import { fetchQuery, graphql } from 'react-relay';
import type { recordingTicketsApiServiceAssignMutation as AssignMutation } from '@/__generated__/recordingTicketsApiServiceAssignMutation.graphql';
import type { recordingTicketsApiServiceQuery as TicketsQuery } from '@/__generated__/recordingTicketsApiServiceQuery.graphql';
import type { recordingTicketsApiServiceUnassignMutation as UnassignMutation } from '@/__generated__/recordingTicketsApiServiceUnassignMutation.graphql';
import { getRelayEnvironment } from '@/lib/relay';
import { commitMutationPromise } from '@/lib/relay/commit-mutation';
import { type RecordingTicket, toRecordingTicket } from '../components/remote-sessions/recording-tickets';

/**
 * The tickets linked to a remote session (`RemoteSession.tickets`), read
 * through the recording the page shows, and the assign / unassign that change
 * them. Both mutations answer with the session, so the table is replaced from
 * the payload instead of read again.
 */

const ticketsQuery = graphql`
  query recordingTicketsApiServiceQuery($recordingId: String!) {
    remoteSessionRecording(recordingId: $recordingId) {
      session {
        tickets {
          ...recordingTickets_ticket
        }
      }
    }
  }
`;

const assignMutation = graphql`
  mutation recordingTicketsApiServiceAssignMutation($input: AssignRecordingTicketsInput!) {
    assignRecordingTickets(input: $input) {
      session {
        tickets {
          ...recordingTickets_ticket
        }
      }
      userErrors {
        code
        message
      }
    }
  }
`;

const unassignMutation = graphql`
  mutation recordingTicketsApiServiceUnassignMutation($sessionId: String!, $ticketId: String!) {
    unassignRecordingTicket(sessionId: $sessionId, ticketId: $ticketId) {
      session {
        tickets {
          ...recordingTickets_ticket
        }
      }
      userErrors {
        code
        message
      }
    }
  }
`;

/** The server takes 1 to 50 ids a call; past that the request fails validation instead of answering. */
export const MAX_ASSIGNED_TICKETS = 50;

/** The linked tickets, the session's own first, then by link time. */
export async function fetchRecordingTickets(recordingId: string): Promise<RecordingTicket[]> {
  const data = await fetchQuery<TicketsQuery>(
    getRelayEnvironment(),
    ticketsQuery,
    { recordingId },
    { fetchPolicy: 'network-only' },
  ).toPromise();
  return data?.remoteSessionRecording?.session.tickets.map(toRecordingTicket) ?? [];
}

/** Links tickets to the session; resolves the session's tickets after it. */
export async function assignRecordingTickets(sessionId: string, ticketIds: string[]): Promise<RecordingTicket[]> {
  const payload = await commitMutationPromise<AssignMutation>(assignMutation, { input: { sessionId, ticketIds } });
  const { session, userErrors } = payload.assignRecordingTickets;
  if (userErrors[0]) throw new Error(userErrors[0].message || 'Could not assign the tickets');
  return session?.tickets.map(toRecordingTicket) ?? [];
}

/** Unlinks one ticket; the ticket itself stays as it is. Resolves the session's tickets after it. */
export async function unassignRecordingTicket(sessionId: string, ticketId: string): Promise<RecordingTicket[]> {
  const payload = await commitMutationPromise<UnassignMutation>(unassignMutation, { sessionId, ticketId });
  const { session, userErrors } = payload.unassignRecordingTicket;
  if (userErrors[0]) throw new Error(userErrors[0].message || 'Could not unassign the ticket');
  return session?.tickets.map(toRecordingTicket) ?? [];
}
