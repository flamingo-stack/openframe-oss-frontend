import { graphql } from 'react-relay';
import type {
  RecordRemoteSessionActionInput,
  remoteSessionActionsApiServiceRecordMutation as RecordMutation,
} from '@/__generated__/remoteSessionActionsApiServiceRecordMutation.graphql';
import { RemoteSessionActionSource, RemoteSessionActionType } from '@/generated/schema-enums';
import type { Instant } from '@/lib/graphql-scalars';
import { getRelayErrorCodes } from '@/lib/handle-api-error';
import { OfflineError } from '@/lib/query-state';
import { commitMutationPromise } from '@/lib/relay/commit-mutation';

/**
 * What the technician did in the remote desktop console, reported to the
 * session's timeline (`recordRemoteSessionAction`, one action per call). Only
 * the controlling technician's console reports; the server stamps the time
 * that orders the timeline, so a report may arrive late without harm.
 */

const recordMutation = graphql`
  mutation remoteSessionActionsApiServiceRecordMutation($input: RecordRemoteSessionActionInput!) {
    recordRemoteSessionAction(input: $input) {
      accepted
      userErrors {
        code
      }
    }
  }
`;

/** A console action and the fields it carries - the server refuses any other field. */
export type RemoteSessionAction =
  | { action: 'INPUT_ENABLED' | 'INPUT_DISABLED' | 'CTRL_ALT_DEL' }
  | { action: 'SHORTCUT_SENT'; label: string; source: 'MENU' | 'KEYBOARD' }
  | { action: 'MONITOR_SWITCHED'; toMonitorId: number; fromMonitorId?: number | null; label?: string };

/** The server's label rule: letters, digits, spaces and "+", 1 to 40 characters. */
const LABEL_PATTERN = /^[A-Za-z0-9+ ]{1,40}$/;

/** Monitor ids the server accepts; the agent's combined "all displays" id (0xFFFF) is not one. */
function isMonitorId(id: number | null | undefined): id is number {
  return typeof id === 'number' && Number.isInteger(id) && id >= 0 && id <= 15;
}

/**
 * The mutation input for one action, or null when the action cannot be
 * reported as asked (a label or a monitor the server would refuse): a refused
 * report is dropped anyway, so it is not sent at all. Optional fields that do
 * not fit are left out rather than losing the action.
 */
export function toActionInput(
  sessionId: string,
  action: RemoteSessionAction,
  clientEventId: string,
  clientTime: Instant,
): RecordRemoteSessionActionInput | null {
  const base = { sessionId, clientEventId, clientTime };
  switch (action.action) {
    case 'INPUT_ENABLED':
      return { ...base, action: RemoteSessionActionType.INPUT_ENABLED };
    case 'INPUT_DISABLED':
      return { ...base, action: RemoteSessionActionType.INPUT_DISABLED };
    case 'CTRL_ALT_DEL':
      return { ...base, action: RemoteSessionActionType.CTRL_ALT_DEL };
    case 'SHORTCUT_SENT':
      if (!LABEL_PATTERN.test(action.label)) return null;
      return {
        ...base,
        action: RemoteSessionActionType.SHORTCUT_SENT,
        label: action.label,
        source: RemoteSessionActionSource[action.source],
      };
    case 'MONITOR_SWITCHED':
      if (!isMonitorId(action.toMonitorId)) return null;
      return {
        ...base,
        action: RemoteSessionActionType.MONITOR_SWITCHED,
        toMonitorId: action.toMonitorId,
        ...(isMonitorId(action.fromMonitorId) ? { fromMonitorId: action.fromMonitorId } : {}),
        ...(action.label && LABEL_PATTERN.test(action.label) ? { label: action.label } : {}),
      };
    default:
      return null;
  }
}

/**
 * Worth sending again: the request never got a GraphQL answer - no link, a
 * timeout, a 5xx. A GraphQL error (validation) and a refusal in `userErrors`
 * are final.
 */
export function isRetryableReportError(error: unknown): boolean {
  if (error instanceof OfflineError || error instanceof TypeError) return true;
  if (getRelayErrorCodes(error).length > 0) return false;
  const message = error instanceof Error ? error.message : '';
  return /Relay fetch failed: 5\d\d|timed out/.test(message);
}

/** Sends one action; resolves whether the server stored it. Throws only what {@link isRetryableReportError} judges. */
export async function recordRemoteSessionAction(input: RecordRemoteSessionActionInput): Promise<boolean> {
  const payload = await commitMutationPromise<RecordMutation>(recordMutation, { input });
  return payload.recordRemoteSessionAction.accepted;
}
