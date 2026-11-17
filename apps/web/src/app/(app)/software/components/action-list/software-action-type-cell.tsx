'use client';

import { TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareActionTypeCell_action$key } from '@/__generated__/softwareActionTypeCell_action.graphql';
import { softwareActionKindLabel } from './software-action-kind';

const softwareActionTypeCellFragment = graphql`
  fragment softwareActionTypeCell_action on SoftwareActionRun {
    kind
    version
  }
`;

/** ACTION column: install, update, auto-update or adopt, and the version it goes to (none: the latest). */
export function SoftwareActionTypeCell({ action }: { action: softwareActionTypeCell_action$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws its loading form.
  const data = useFragment(softwareActionTypeCellFragment, useLoadingScope() ? null : action);
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText>{data ? (softwareActionKindLabel(data.kind) ?? data.kind) : ''}</TruncateText>
      {data?.version && (
        <TruncateText variant="h6" tone="secondary">
          {data.version}
        </TruncateText>
      )}
    </div>
  );
}
