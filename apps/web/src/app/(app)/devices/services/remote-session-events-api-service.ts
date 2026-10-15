import { fetchQuery, graphql } from 'react-relay';
import type { remoteSessionEventsApiServicePlayedMutation as PlayedMutation } from '@/__generated__/remoteSessionEventsApiServicePlayedMutation.graphql';
import type { remoteSessionEventsApiServiceQuery as EventsQuery } from '@/__generated__/remoteSessionEventsApiServiceQuery.graphql';
import { RemoteSessionEventType } from '@/generated/schema-enums';
import { getRelayEnvironment } from '@/lib/relay';
import { commitMutationPromise } from '@/lib/relay/commit-mutation';
import { type SessionTimelineEvent, toSessionTimelineEvent } from '../components/remote-sessions/session-events';

/**
 * The Session Events list and the track markers of the recording page: the
 * session's timeline (`RemoteSession.events`), read through the file the page
 * was opened on, and the "someone played it" report that adds to it.
 */

const eventsQuery = graphql`
  query remoteSessionEventsApiServiceQuery(
    $recordingId: String!
    $types: [RemoteSessionEventType!]
    $first: Int!
    $after: String
  ) {
    remoteSessionRecording(recordingId: $recordingId) {
      session {
        events(types: $types, first: $first, after: $after) {
          edges {
            node {
              ...sessionEvents_event
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

const playedMutation = graphql`
  mutation remoteSessionEventsApiServicePlayedMutation($sessionId: String!) {
    recordRecordingPlayed(sessionId: $sessionId) {
      accepted
    }
  }
`;

/** The rows the page lists and marks; the rest of the timeline (request, chat, playback) is not part of the design. */
const LISTED_TYPES: RemoteSessionEventType[] = [
  RemoteSessionEventType.STARTED,
  RemoteSessionEventType.INPUT_ENABLED,
  RemoteSessionEventType.INPUT_DISABLED,
  RemoteSessionEventType.REMOTE_CLIPBOARD_COPIED,
  RemoteSessionEventType.REMOTE_CLIPBOARD_PASTED,
  RemoteSessionEventType.SHORTCUT_SENT,
  RemoteSessionEventType.CTRL_ALT_DEL,
  RemoteSessionEventType.MONITOR_SWITCHED,
  RemoteSessionEventType.ENDED,
  RemoteSessionEventType.RECORDING_KEPT,
  RemoteSessionEventType.RECORDING_RELEASED,
];

/** The server's page ceiling: a usual session fits one page. */
const PAGE_SIZE = 500;

export interface SessionEventsPage {
  events: SessionTimelineEvent[];
  /** The cursor of the next page; null on the last one. */
  nextCursor: string | null;
}

/** One page of the rows the page lists, oldest first. */
export async function fetchSessionEventsPage(recordingId: string, after: string | null): Promise<SessionEventsPage> {
  const data = await fetchQuery<EventsQuery>(
    getRelayEnvironment(),
    eventsQuery,
    { recordingId, types: LISTED_TYPES, first: PAGE_SIZE, after },
    { fetchPolicy: 'network-only' },
  ).toPromise();
  const connection = data?.remoteSessionRecording?.session.events;
  if (!connection) return { events: [], nextCursor: null };
  return {
    events: connection.edges.flatMap(({ node }) => toSessionTimelineEvent(node) ?? []),
    nextCursor: connection.pageInfo.hasNextPage ? (connection.pageInfo.endCursor ?? null) : null,
  };
}

/** Tells the server the recording was played; resolves whether it took the report. */
export async function recordRecordingPlayed(sessionId: string): Promise<boolean> {
  const payload = await commitMutationPromise<PlayedMutation>(playedMutation, { sessionId });
  return payload.recordRecordingPlayed.accepted;
}
