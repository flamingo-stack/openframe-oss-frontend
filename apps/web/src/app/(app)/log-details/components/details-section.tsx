'use client';

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { LogEntry } from '../../logs-page/types/log.types';
import { splitLogDetails } from '../utils/split-log-details';
import { JsonPanel } from './json-panel';

interface DetailsSectionProps {
  /** Absent while the log loads: the section draws its one card's own skeleton. */
  logDetails?: LogEntry | null;
}

/**
 * The payload part of the Log Details page. A script run gets two cards, the
 * input the run was given and what came back; every other log keeps its single
 * "Details" card. See {@link splitLogDetails} for how the backend's `details`
 * JSON maps onto them.
 */
export function DetailsSection({ logDetails }: DetailsSectionProps) {
  if (useLoadingScope() || !logDetails) return <JsonPanel title="Details" value={null} loading />;
  const { input, output, outputTitle } = splitLogDetails(logDetails);

  return (
    <>
      {input !== undefined && <JsonPanel title="Input" value={input} />}
      <JsonPanel title={outputTitle} value={output} />
    </>
  );
}
