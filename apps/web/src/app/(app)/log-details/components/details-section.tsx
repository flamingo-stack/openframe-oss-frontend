'use client';

import type { LogEntry } from '../../logs-page/types/log.types';
import { splitLogDetails } from '../utils/split-log-details';
import { JsonPanel } from './json-panel';

interface DetailsSectionProps {
  logDetails: LogEntry;
}

/**
 * The payload part of the Log Details page. A script run gets two cards, the
 * input the run was given and what came back; every other log keeps its single
 * "Details" card. See {@link splitLogDetails} for how the backend's `details`
 * JSON maps onto them.
 */
export function DetailsSection({ logDetails }: DetailsSectionProps) {
  const { input, output, outputTitle } = splitLogDetails(logDetails);

  return (
    <>
      {input !== undefined && <JsonPanel title="Input" value={input} />}
      <JsonPanel title={outputTitle} value={output} />
    </>
  );
}
