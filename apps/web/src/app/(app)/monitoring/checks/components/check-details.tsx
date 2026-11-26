'use client';

import { IncidentSeverityTag } from '@/app/(app)/incidents/components/incident-tags';
import { INCIDENT_TYPE_LABELS, labelOf } from '@/app/(app)/incidents/utils/incident-labels';
import { formatRunsEvery } from '../utils/check-labels';
import type { Check } from '../utils/check-transform';
import { DetailsItem, DetailsPanel } from './details-panel';

/**
 * Severity, category, how often it runs and how many exceptions change it. The API has no open incidents,
 * devices checked, last run or last edit per check yet, so the design's other items are not drawn.
 */
export function CheckDetails({ check }: { check?: Check }) {
  return (
    <DetailsPanel columns="four">
      <DetailsItem label="Severity" value={<IncidentSeverityTag severity={check?.severity} />} />
      <DetailsItem
        label="Category"
        value={check ? labelOf(INCIDENT_TYPE_LABELS, check.type) : ''}
        skeletonWidth="w-16"
      />
      <DetailsItem
        label="Runs every"
        value={check ? formatRunsEvery(check.intervalSeconds) : ''}
        skeletonWidth="w-12"
      />
      <DetailsItem label="Exceptions" value={check ? String(check.overrideCount) : ''} skeletonWidth="w-8" />
    </DetailsPanel>
  );
}
