'use client';

import { DataTable, TruncateText, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareActionNameCell_action$key } from '@/__generated__/softwareActionNameCell_action.graphql';
import { softwareActionKindLabel } from './software-action-kind';

const softwareActionNameCellFragment = graphql`
  fragment softwareActionNameCell_action on SoftwareActionRun {
    software
    kind
    version
  }
`;

/**
 * SOFTWARE column: the package, and below the content area's md step (mobile frame 1049:16193), where the Action
 * column is shed, the action and its version under it ("Update, 152.0.7977.65").
 */
export function SoftwareActionNameCell({ action }: { action: softwareActionNameCell_action$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws the name as a bar.
  const data = useFragment(softwareActionNameCellFragment, useLoadingScope() ? null : action);
  const kind = data ? (softwareActionKindLabel(data.kind) ?? data.kind) : '';
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText>{data?.software ?? ''}</TruncateText>
      {data && (
        <TruncateText variant="h6" tone="secondary" className="content-md:hidden" data-loading-optional>
          {data.version ? `${kind}, ${data.version}` : kind}
        </TruncateText>
      )}
    </div>
  );
}

/**
 * SOFTWARE column in the grid layout: the package alone. The action and its version, which a card row shows under it
 * where the Action column is shed, have their own column at every width of the grid.
 */
export function SoftwareActionNameGridCell({ action }: { action: softwareActionNameCell_action$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws the name as a bar.
  const data = useFragment(softwareActionNameCellFragment, useLoadingScope() ? null : action);
  return <DataTable.Cell text={data?.software ?? ''} />;
}
