'use client';

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
  const { respondedMachineCount, totalMachineCount } = useFragment(softwareActionProcessedCellFragment, action);
  return (
    <span className="text-ods-text-primary text-h4">
      <ProcessedDevicesCount responded={respondedMachineCount} total={totalMachineCount} />
    </span>
  );
}
