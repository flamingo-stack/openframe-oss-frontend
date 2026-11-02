'use client';

import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareActionProcessedCell_action$key } from '@/__generated__/softwareActionProcessedCell_action.graphql';
import { ProcessedDevicesCount } from '../shared/processed-devices-count';

const softwareActionProcessedCellFragment = graphql`
  fragment softwareActionProcessedCell_action on SoftwareActionRun {
    respondedMachineCount
    totalMachineCount
  }
`;

/** PROCESSED DEVICES column: how many of the run's devices have reported back. */
export function SoftwareActionProcessedCell({ action }: { action: softwareActionProcessedCell_action$key }) {
  // A row still being read (a loading scope) has no fragment to read: the cell draws its loading form.
  const data = useFragment(softwareActionProcessedCellFragment, useLoadingScope() ? null : action);
  if (!data) return <TextLineSkeleton type="h4" as="span" className="w-16" />;
  return (
    <span className="text-ods-text-primary text-h4">
      <ProcessedDevicesCount responded={data.respondedMachineCount} total={data.totalMachineCount} />
    </span>
  );
}
