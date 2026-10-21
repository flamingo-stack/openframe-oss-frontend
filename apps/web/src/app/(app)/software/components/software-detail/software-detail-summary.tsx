'use client';

import { graphql, useFragment } from 'react-relay';
import type { softwareDetailSummary_software$key } from '@/__generated__/softwareDetailSummary_software.graphql';
import { SummaryCard } from '../shared/summary-card';
import { SOFTWARE_DETAIL_SUMMARY_LABELS as LABELS } from './software-detail-summary-labels';

const softwareDetailSummaryFragment = graphql`
  fragment softwareDetailSummary_software on Software {
    publisher
    latestVersion
  }
`;

/** The summary card: publisher and latest version. Null before the record answers (a loading scope: values are bars). */
export function SoftwareDetailSummary({ software }: { software: softwareDetailSummary_software$key | null }) {
  const data = useFragment(softwareDetailSummaryFragment, software);
  return (
    <SummaryCard
      columns={2}
      fields={[
        { label: LABELS.publisher, value: data?.publisher },
        { label: LABELS.latestVersion, value: data?.latestVersion },
      ]}
    />
  );
}
