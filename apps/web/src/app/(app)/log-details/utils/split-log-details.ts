import type { LogEntry } from '../../logs-page/types/log.types';

/** Title of the section that shows everything the backend wrote besides the input. */
export type LogOutputTitle = 'Output' | 'Details';

export interface LogPayloadSections {
  /**
   * What the run was given — `details.result.input`, which the stream service
   * writes for script runs. Absent for every other event and for script runs
   * logged before the backend started attaching it.
   */
  input?: unknown;
  /** The rest of the details: the result block without its input, the error block, additional info. */
  output: unknown;
  /** "Output" when the log has an input to stand against it; "Details" for the generic single-block case. */
  outputTitle: LogOutputTitle;
}

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The structured stand-in shown when a log carries no parseable `details`:
 * the same identifying fields the Full Information card lists, so the panel is
 * never empty.
 */
function fallbackDetails(log: LogEntry, rawDetails?: string): JsonObject {
  return {
    toolEventId: log.toolEventId,
    eventType: log.eventType,
    toolType: log.toolType,
    severity: log.severity,
    userId: log.userId,
    deviceId: log.deviceId,
    timestamp: log.timestamp,
    ingestDay: log.ingestDay,
    message: log.message,
    ...(rawDetails !== undefined && { rawDetails }),
  };
}

/**
 * Splits a log's `details` JSON into the Input and Output panels of the Log
 * Details page.
 *
 * For a script run the backend nests the script's input under
 * `result.input`, next to the output of the same run. The page shows the two
 * side by side, so the input is lifted out and the rest stays exactly as the
 * backend wrote it (`result` without `input`, `error`, `additional_info`): the
 * keys are the backend's, nothing is renamed or flattened. A log with no
 * `result.input` (Fleet audit, MeshCentral, older script runs) keeps the single
 * "Details" panel it always had.
 */
export function splitLogDetails(log: LogEntry): LogPayloadSections {
  if (!log.details) {
    return { output: fallbackDetails(log), outputTitle: 'Details' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(log.details);
  } catch {
    return { output: fallbackDetails(log, log.details), outputTitle: 'Details' };
  }

  if (!isJsonObject(parsed) || !isJsonObject(parsed.result) || !('input' in parsed.result)) {
    return { output: parsed, outputTitle: 'Details' };
  }

  const { input, ...result } = parsed.result;
  const output: JsonObject = { ...parsed };
  if (Object.keys(result).length > 0) {
    output.result = result;
  } else {
    delete output.result;
  }
  return { input, output, outputTitle: 'Output' };
}
