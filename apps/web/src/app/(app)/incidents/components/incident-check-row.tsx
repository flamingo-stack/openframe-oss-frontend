'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { incidentCheckRowQuery as IncidentCheckRowQueryType } from '@/__generated__/incidentCheckRowQuery.graphql';
import { useChecksGate } from '@/app/(app)/monitoring/checks/hooks/use-checks-gate';
import {
  formatThreshold,
  joinThresholds,
  NO_THRESHOLD_LABEL,
  thresholdScopeLabel,
} from '@/app/(app)/monitoring/checks/utils/check-labels';
import { ContentErrorBoundary } from '@/app/components/shared';
import { InfoCell } from '@/app/components/shared/info-cell';
import { IncidentCheckLinkCell } from './incident-check-link-cell';
import { SummaryCell } from './incident-summary-cell';
import { SummaryRow } from './incident-summary-row';

/**
 * What the incident was measured against and the check that opened it. Its own read, behind the check settings flag:
 * the API serves these fields only where the check settings run.
 */
const incidentCheckRowQuery = graphql`
  query incidentCheckRowQuery($id: ID!) {
    insight(id: $id) {
      thresholds {
        unit
        firesWhen
        value
        scopeType
        scopeName
      }
      check
    }
  }
`;

/**
 * The incident's check strip: the threshold it was measured against, where that threshold was set ("Tag · kiosk",
 * "Default · all devices"), and a link to the check's page. Nothing while the flag is off, and nothing for an incident
 * no built-in check opened or one recorded before thresholds were kept. While the strip is read it draws itself.
 */
export function IncidentCheckRow({ incidentId }: { incidentId: string }) {
  if (useChecksGate() !== 'on') return null;
  return (
    <ContentErrorBoundary fallback={() => null}>
      <IncidentCheckRowIsland incidentId={incidentId} />
    </ContentErrorBoundary>
  );
}

function IncidentCheckRowIsland({ incidentId }: { incidentId: string }) {
  return (
    <LoadingSuspense label="Loading the check">
      <IncidentCheckRowReader incidentId={incidentId} />
    </LoadingSuspense>
  );
}

function IncidentCheckRowReader({ incidentId }: { incidentId: string }) {
  // In a loading scope it draws the strip with no data and runs no read.
  if (useLoadingScope()) return <IncidentCheckStrip />;
  return <IncidentCheckRowLive incidentId={incidentId} />;
}

function IncidentCheckRowLive({ incidentId }: { incidentId: string }) {
  const { insight } = useLazyLoadQuery<IncidentCheckRowQueryType>(
    incidentCheckRowQuery,
    { id: incidentId },
    { fetchPolicy: 'store-or-network' },
  );
  const thresholds = insight.thresholds ?? [];
  if (thresholds.length === 0 && !insight.check) return null;

  const threshold =
    thresholds.length > 0
      ? joinThresholds(thresholds.map(item => formatThreshold(item.value, item.unit ?? null, item.firesWhen ?? null)))
      : NO_THRESHOLD_LABEL;
  // Every parameter of a check is resolved at its own scope; the usual case is one.
  const appliesTo = [...new Set(thresholds.map(item => thresholdScopeLabel(item.scopeType, item.scopeName ?? null)))];

  return (
    <IncidentCheckStrip
      strip={{ threshold, appliesTo: appliesTo.length > 0 ? appliesTo.join(', ') : null, check: insight.check ?? null }}
    />
  );
}

interface IncidentCheckStripProps {
  /** Absent while the strip is read: it draws the usual incident's strip (threshold, where it applies, the check), each
   *  value a bar. */
  strip?: { threshold: string; appliesTo: string | null; check: string | null };
}

function IncidentCheckStrip({ strip }: IncidentCheckStripProps) {
  return (
    <SummaryRow>
      <SummaryCell>
        <InfoCell value={strip?.threshold ?? ''} label="Threshold" />
      </SummaryCell>
      {(!strip || strip.appliesTo) && (
        <SummaryCell>
          <InfoCell value={strip?.appliesTo ?? ''} label="Applies to" />
        </SummaryCell>
      )}
      {(!strip || strip.check) && (
        <SummaryCell>
          <IncidentCheckLinkCell check={strip?.check ?? undefined} />
        </SummaryCell>
      )}
    </SummaryRow>
  );
}
