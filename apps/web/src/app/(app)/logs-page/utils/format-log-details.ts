import { graphql } from 'react-relay';
import { readInlineData } from 'relay-runtime';
import type { formatLogDetails_log$data, formatLogDetails_log$key } from '@/__generated__/formatLogDetails_log.graphql';

/**
 * What every "Copy Log Details" affordance puts on the clipboard — the
 * log-details page action, the logs table row button and the "Log Details"
 * drawer. Selected once here, so the three payloads cannot drift and no caller
 * restates the field list by hand.
 *
 * `@inline` because the reader is {@link formatLogDetailsForCopy}, a plain
 * function — not a component.
 */
export const formatLogDetailsFragment = graphql`
  fragment formatLogDetails_log on LogDetails @inline {
    toolEventId
    severity
    timestamp
    toolType
    eventType
    message
    details
  }
`;

/**
 * The copy payload as plain data, Relay's fragment marker dropped: the door for
 * the log-details page, which still reads its log over raw POST and so has no
 * fragment reference to hand over.
 */
export type CopyableLogDetails = Omit<formatLogDetails_log$data, ' $fragmentType'>;

/** Canonical plain-text representation of a log, identical wherever it is copied from. */
export function formatLogDetailsForCopy(log: CopyableLogDetails): string {
  return [
    `Log ID: ${log.toolEventId}`,
    `Status: ${log.severity}`,
    `Timestamp: ${log.timestamp}`,
    `Tool Type: ${log.toolType}`,
    `Event Type: ${log.eventType}`,
    `Message: ${log.message || 'No message available'}`,
    `Details: ${log.details || 'No details available'}`,
  ].join('\n');
}

/** {@link formatLogDetailsForCopy} over a `LogDetails` that a Relay operation spread `...formatLogDetails_log` on. */
export function formatLogDetailsRefForCopy(ref: formatLogDetails_log$key): string {
  return formatLogDetailsForCopy(readInlineData(formatLogDetailsFragment, ref));
}
