'use client';

import { useChecksGate } from '@/app/(app)/monitoring/checks/hooks/use-checks-gate';
import {
  formatThreshold,
  joinThresholds,
  NO_THRESHOLD_LABEL,
  thresholdScopeLabel,
} from '@/app/(app)/monitoring/checks/utils/check-labels';
import { InfoCell } from '@/app/components/shared/info-cell';
import type { Incident } from '../utils/incident-transform';
import { IncidentCheckLinkCell } from './incident-check-link-cell';
import { SummaryCell } from './incident-summary-cell';
import { SummaryRow } from './incident-summary-row';

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
      ? joinThresholds(thresholds.map(item => formatThreshold(item.value, item.unit ?? null, item.firesWhen ?? null)))
      : NO_THRESHOLD_LABEL;
  // Every parameter of a check is resolved at its own scope; the usual case is one.
  const appliesTo = [...new Set(thresholds.map(item => thresholdScopeLabel(item.scopeType, item.scopeName ?? null)))];

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
          <IncidentCheckLinkCell check={incident.check} />
        </SummaryCell>
      )}
    </SummaryRow>
  );
}
