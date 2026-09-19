'use client';

import { graphql, useFragment } from 'react-relay';
import type { softwareDetailHeader_software$key } from '@/__generated__/softwareDetailHeader_software.graphql';
import { routes } from '@/lib/routes';
import { DetailTitle } from '../shared/detail-title';
import { SOFTWARE_DETAIL_TITLE } from './software-detail-title';

const softwareDetailHeaderFragment = graphql`
  fragment softwareDetailHeader_software on Software {
    name
  }
`;

/** The page title IS the record. Null for an unknown id — the Back button is drawn either way. */
export function SoftwareDetailHeader({ software }: { software: softwareDetailHeader_software$key | null | undefined }) {
  const data = useFragment(softwareDetailHeaderFragment, software);
  return <DetailTitle title={data?.name ?? SOFTWARE_DETAIL_TITLE} backTo={routes.software.list} />;
}
