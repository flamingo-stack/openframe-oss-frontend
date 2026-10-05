'use client';

import { QueryReportTable } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import type { Incident } from '../utils/incident-transform';

/**
 * "Query Details": the osquery rows the finding was made from, in the same
 * report table the Monitoring query page uses. Columns are the detecting
 * query's own column names (they vary by kind). No device column: an incident
 * belongs to exactly one machine, which the summary card already names.
 */
export function IncidentQueryResults({ incident }: { incident: Incident }) {
  return (
    <QueryResultsFrame>
      <QueryReportTable
        data={incident.queryResult ?? []}
        showExport={false}
        emptyMessage={
          incident.queryResult
            ? 'The latest run of the detecting query returned no rows.'
            : 'Evidence was not kept for this incident.'
        }
      />
    </QueryResultsFrame>
  );
}

/** The section's shell — the heading over the table — shared by the loaded state and its skeleton. */
function QueryResultsFrame({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-m)]">
      <h2 className="text-ods-text-primary text-h2">Query Details</h2>
      {children}
    </section>
  );
}

/**
 * The same heading over the report table's own loading rows. The column count
 * is the detecting query's and unknown until the record lands; three is the
 * common shape, one row the common count.
 */
export function IncidentQueryResultsSkeleton() {
  return (
    <QueryResultsFrame>
      <QueryReportTable data={[]} loading skeletonRows={1} skeletonColumns={3} showExport={false} />
    </QueryResultsFrame>
  );
}
