'use client';

import { softwareActionCopy } from '@flamingo-stack/openframe-frontend-core/components/features';
import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareActionTypeCell_action$key } from '@/__generated__/softwareActionTypeCell_action.graphql';

const softwareActionTypeCellFragment = graphql`
  fragment softwareActionTypeCell_action on SoftwareActionRun {
    action
  }
`;

/** ACTION column: install or update. */
export function SoftwareActionTypeCell({ action }: { action: softwareActionTypeCell_action$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws its loading form.
  const data = useFragment(softwareActionTypeCellFragment, useLoadingScope() ? null : action);
  return <TruncateText>{data ? (softwareActionCopy(data.action)?.verb ?? data.action) : ''}</TruncateText>;
}
