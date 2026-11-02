'use client';

import { QueryReportTable, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { oneLineEmptyState } from '@/app/components/shared/empty-state';
import type { Incident } from '../utils/incident-transform';

/**
 * The evidence table's loading rows. The rows are the detecting query's and unbounded, and its columns are unknown
 * until the record lands: three columns is the common shape, one row the common count.
 */
const INCIDENT_EVIDENCE_SKELETON_ROWS = 1;
const INCIDENT_EVIDENCE_SKELETON_COLUMNS = 3;

/**
 * "Query Details": the osquery rows the finding was made from, in the same
 * report table the Monitoring query page uses. Columns are the detecting
 * query's own column names (they vary by kind). No device column: an incident
 * belongs to exactly one machine, which the summary card already names.
 * Without a record (or in a loading scope) it draws the report table's own loading rows.
 */
export function IncidentQueryResults({ incident }: { incident?: Incident }) {
  const loading = useLoadingScope() || !incident;
  return (
    <QueryResultsFrame>
      <QueryReportTable
        data={incident?.queryResult ?? []}
        loading={loading}
        loadingRegion={false}
        skeletonRows={INCIDENT_EVIDENCE_SKELETON_ROWS}
        skeletonColumns={INCIDENT_EVIDENCE_SKELETON_COLUMNS}
        showExport={false}
        emptyState={oneLineEmptyState(
          incident?.queryResult
            ? 'The latest run of the detecting query returned no rows.'
            : 'Evidence was not kept for this incident.',
        )}
      />
    </QueryResultsFrame>
  );
}

/** The section's shell: the heading over the table, loaded or loading. */
function QueryResultsFrame({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-m)]">
      <h2 className="text-ods-text-primary text-h2">Query Details</h2>
      {children}
    </section>
  );
}
