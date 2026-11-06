'use client';

import { graphql, useFragment } from 'react-relay';
import type { softwareDetailSummary_software$key } from '@/__generated__/softwareDetailSummary_software.graphql';
import { SoftwareType } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';
import { SummaryCard } from '../shared/summary-card';
import { SOFTWARE_DETAIL_SUMMARY_LABELS as LABELS } from './software-detail-summary-labels';

const softwareDetailSummaryFragment = graphql`
  fragment softwareDetailSummary_software on Software {
    type
    latestVersion
  }
`;

/** Every kind of software, as the card's Type words it (see `presentationFor`). */
const SOFTWARE_TYPE_LABEL: Record<SoftwareType, string> = {
  [SoftwareType.APPLICATION]: 'Application',
  [SoftwareType.BROWSER_EXTENSION]: 'Browser Extension',
  [SoftwareType.PACKAGE]: 'Package',
  [SoftwareType.OTHER]: 'Other',
};

/**
 * The summary card: type and latest version (design 1100:444, without its publisher and OS: the API never fills the
 * one and has no platform for a title). Null before the record answers (a loading scope: values are bars).
 */
export function SoftwareDetailSummary({ software }: { software: softwareDetailSummary_software$key | null }) {
  const data = useFragment(softwareDetailSummaryFragment, software);
  return (
    <SummaryCard
      columns={2}
      fields={[
        {
          label: LABELS.type,
          value: data?.type ? (presentationFor(SOFTWARE_TYPE_LABEL, data.type) ?? data.type) : null,
        },
        { label: LABELS.latestVersion, value: data?.latestVersion },
      ]}
    />
  );
}
