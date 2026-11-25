'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import Link from 'next/link';
import { useLazyLoadQuery } from 'react-relay';
import type { incidentCheckLinkQuery as CheckLinkQueryType } from '@/__generated__/incidentCheckLinkQuery.graphql';
import { useChecksGate } from '@/app/(app)/monitoring/checks/hooks/use-checks-gate';
import {
  formatThreshold,
  joinThresholds,
  NO_THRESHOLD_LABEL,
  thresholdScopeLabel,
} from '@/app/(app)/monitoring/checks/utils/check-labels';
import { ContentErrorBoundary } from '@/app/components/shared';
import { InfoCell } from '@/app/components/shared/info-cell';
import { incidentCheckLinkQuery } from '@/graphql/insights/incident-check-link-query';
import { routes } from '@/lib/routes';
import type { Incident } from '../utils/incident-transform';
import { SummaryCell, SummaryRow } from './incident-summary-strip';

const LINK_CLASS = 'text-ods-accent underline hover:text-ods-accent-hover';

/**
 * The incident's check strip: the threshold it was measured against, where that threshold was set
 * ("Tag · kiosk", "Default · all devices"), and a link to the check's page. Nothing for an incident
 * no built-in check opened, nor for one recorded before thresholds were kept.
 */
export function IncidentCheckRow({ incident }: { incident: Incident }) {
  const gate = useChecksGate();
  const thresholds = incident.thresholds ?? [];
  if (thresholds.length === 0 && !incident.check) return null;

  const threshold =
    thresholds.length > 0
      ? joinThresholds(thresholds.map(item => formatThreshold(item.value, item.unit, item.firesWhen)))
      : NO_THRESHOLD_LABEL;
  // Every parameter of a check is resolved at its own scope; the usual case is one.
  const appliesTo = [...new Set(thresholds.map(item => thresholdScopeLabel(item.scopeType, item.scopeName)))];

  return (
    <SummaryRow>
      <SummaryCell optional>
        <InfoCell value={threshold} label="Threshold" />
      </SummaryCell>
      {appliesTo.length > 0 && (
        <SummaryCell optional>
          <InfoCell value={appliesTo.join(', ')} label="Applies to" />
        </SummaryCell>
      )}
      {gate === 'on' && incident.check && (
        <SummaryCell optional>
          <CheckLinkCell check={incident.check} />
        </SummaryCell>
      )}
    </SummaryRow>
  );
}

/** The check's name, linking to its page; read on its own, so the card does not wait for it. */
function CheckLinkCell({ check }: { check: string }) {
  return (
    <ContentErrorBoundary
      fallback={() => (
        <InfoCell
          value={
            <Link href={routes.monitoring.check(check)} className={LINK_CLASS}>
              Open check
            </Link>
          }
          label="Check"
        />
      )}
    >
      <CheckLinkIsland check={check} />
    </ContentErrorBoundary>
  );
}

function CheckLinkIsland({ check }: { check: string }) {
  return (
    <LoadingSuspense label="Loading check">
      <CheckLinkCellScope check={check} />
    </LoadingSuspense>
  );
}

function CheckLinkCellScope({ check }: { check: string }) {
  if (useLoadingScope()) return <InfoCell value="" label="Check" skeletonWidth="w-24" />;
  return <CheckLinkCellLive check={check} />;
}

function CheckLinkCellLive({ check }: { check: string }) {
  const data = useLazyLoadQuery<CheckLinkQueryType>(
    incidentCheckLinkQuery,
    { check },
    { fetchPolicy: 'store-or-network' },
  );
  return (
    <InfoCell
      value={
        <Link href={routes.monitoring.check(check)} className={LINK_CLASS}>
          {data.insightCheck.title}
        </Link>
      }
      label="Check"
    />
  );
}
