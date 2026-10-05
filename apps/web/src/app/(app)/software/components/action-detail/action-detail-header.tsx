'use client';

import { graphql, useFragment } from 'react-relay';
import type { actionDetailHeader_action$key } from '@/__generated__/actionDetailHeader_action.graphql';
import { routes } from '@/lib/routes';
import { DetailTitle } from '../shared/detail-title';
import { SOFTWARE_ACTION_DETAIL_TITLE, softwareActionCopy } from '../shared/software-action-copy';

const actionDetailHeaderFragment = graphql`
  fragment actionDetailHeader_action on SoftwareActionRun {
    action
  }
`;

/** The title names the run's kind — update or install. Null for an id with no run behind it. */
export function ActionDetailHeader({ action }: { action: actionDetailHeader_action$key | null | undefined }) {
  const data = useFragment(actionDetailHeaderFragment, action);
  const title = (data && softwareActionCopy(data.action)?.detailTitle) ?? SOFTWARE_ACTION_DETAIL_TITLE;
  return <DetailTitle title={title} backTo={routes.software.actions} />;
}
