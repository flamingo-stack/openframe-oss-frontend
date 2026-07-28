import type { LogEntry } from '../types/log.types';

/** The subset of a log actually rendered into the copy payload. */
export type CopyableLogDetails = Pick<
  LogEntry,
  'toolEventId' | 'timestamp' | 'toolType' | 'eventType' | 'message' | 'details'
> & {
  severity: string;
};

/**
 * Canonical plain-text representation of a log used by every "Copy Log Details"
 * affordance (the log-details page action, the logs table row button and the
 * "Log Details" drawer), so the payload stays identical wherever it appears.
 */
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
