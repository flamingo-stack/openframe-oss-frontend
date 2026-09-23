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

/** The summary card: publisher and latest version. */
export function SoftwareDetailSummary({ software }: { software: softwareDetailSummary_software$key }) {
  const { publisher, latestVersion } = useFragment(softwareDetailSummaryFragment, software);
  return (
    <SummaryCard
      columns={2}
      fields={[
        { label: LABELS.publisher, value: publisher },
        { label: LABELS.latestVersion, value: latestVersion },
      ]}
    />
  );
}
