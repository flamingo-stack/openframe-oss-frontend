'use client';

import { TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareActionTypeCell_action$key } from '@/__generated__/softwareActionTypeCell_action.graphql';
import { softwareActionCopy } from '../shared/software-action-copy';

const softwareActionTypeCellFragment = graphql`
  fragment softwareActionTypeCell_action on SoftwareActionRun {
    action
  }
`;

/** ACTION column: install or update. */
export function SoftwareActionTypeCell({ action }: { action: softwareActionTypeCell_action$key }) {
  const data = useFragment(softwareActionTypeCellFragment, action);
  return <TruncateText>{softwareActionCopy(data.action)?.verb ?? data.action}</TruncateText>;
}
