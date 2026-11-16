'use client';

import { OSTypeIcon } from '@flamingo-stack/openframe-frontend-core/components/features';
import { getOSLabel } from '@flamingo-stack/openframe-frontend-core/utils';
import { graphql, useFragment } from 'react-relay';
import type { softwareDetailSummary_software$key } from '@/__generated__/softwareDetailSummary_software.graphql';
import { SoftwareType } from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';
import { SummaryCard } from '../shared/summary-card';
import { SOFTWARE_DETAIL_SUMMARY_LABELS as LABELS } from './software-detail-summary-labels';

const softwareDetailSummaryFragment = graphql`
  fragment softwareDetailSummary_software on Software {
    type
    os
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

const OS_ICON_SIZE = 'size-5';

/**
 * The summary card: type, OS and latest version (design 1100:444, without its publisher: the API never fills it).
 * No OS is a kind several systems have (a browser extension, an npm package): the empty mark. Null before the record
 * answers (a loading scope: values are bars).
 */
export function SoftwareDetailSummary({ software }: { software: softwareDetailSummary_software$key | null }) {
  const data = useFragment(softwareDetailSummaryFragment, software);
  return (
    <SummaryCard
      columns={3}
      fields={[
        {
          label: LABELS.type,
          value: data?.type ? (presentationFor(SOFTWARE_TYPE_LABEL, data.type) ?? data.type) : null,
        },
        {
          label: LABELS.os,
          value: data?.os ? getOSLabel(data.os) : null,
          icon: data?.os ? <OSTypeIcon osType={data.os} size={OS_ICON_SIZE} /> : undefined,
          iconSkeleton: { className: OS_ICON_SIZE },
        },
        { label: LABELS.latestVersion, value: data?.latestVersion },
      ]}
    />
  );
}
