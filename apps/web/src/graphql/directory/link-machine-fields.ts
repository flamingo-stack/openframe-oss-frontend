import { getDeviceName } from '@flamingo-stack/openframe-frontend-core/components/features';
import { graphql, readInlineData } from 'react-relay';
import type { linkMachineFields_machine$key } from '@/__generated__/linkMachineFields_machine.graphql';
import { machineLinkFacts, machineSummary } from '@/app/(app)/users/utils/device-presentation';

/** An agent machine as the user's Devices tab and the Link modal name it. */
export const linkMachineFieldsFragment = graphql`
  fragment linkMachineFields_machine on Machine @inline {
    id
    machineId
    hostname
    displayName
    nickname
    type
    status
    lastSeen
    osVersion
    serialNumber
    directorySources
  }
`;

export interface LinkMachine {
  id: string;
  /** The agent id: what `linkDirectoryDevice` and the device page take, not the Relay `id`. */
  machineId: string;
  name: string;
  hostname: string | null;
  type: string | null;
  status: string | null;
  lastSeen: string | null;
  summary: string;
  facts: string;
}

export function toLinkMachine(ref: linkMachineFields_machine$key): LinkMachine {
  const machine = readInlineData(linkMachineFieldsFragment, ref);
  return {
    id: machine.id,
    machineId: machine.machineId,
    name: getDeviceName(machine),
    hostname: machine.hostname ?? null,
    type: machine.type ?? null,
    status: machine.status ?? null,
    lastSeen: machine.lastSeen ?? null,
    summary: machineSummary(machine.type, machine.osVersion),
    facts: machineLinkFacts(machine.serialNumber, machine.directorySources),
  };
}
