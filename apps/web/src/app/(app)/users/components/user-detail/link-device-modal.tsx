'use client';

import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import {
  DeviceConnectivityIcon,
  DeviceLifecycleTag,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  Button,
  RadioGroup,
  RadioGroupItem,
  SearchInput,
  Tag,
  TruncateText,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useDebounce, useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { formatRelativeTime } from '@flamingo-stack/openframe-frontend-core/utils';
import { useDeferredValue, useEffect, useState } from 'react';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';
import type { linkDeviceModalMutation as LinkDeviceMutationType } from '@/__generated__/linkDeviceModalMutation.graphql';
import type { linkDeviceModalQuery as LinkDeviceQueryType } from '@/__generated__/linkDeviceModalQuery.graphql';
import { ContentErrorBoundary, SectionLoadError, useRetryKey } from '@/app/components/shared';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import { DeviceStatus } from '@/generated/schema-enums';
import { toRelayDeviceFilter } from '@/graphql/devices/to-relay-device-filter';
import { type LinkMachine, toLinkMachine } from '@/graphql/directory/link-machine-fields';
import { getRelayErrorMessage } from '@/lib/handle-api-error';

// The Link modal (Figma 1284:173): a suggestion or any agent machine of the tenant (D25), whichever customer it is in,
// so the list is the devices query and not the record's own suggestions. There is no unlink (D26).

/** The first page; a longer fleet is narrowed by typing. */
const MACHINES_LIMIT = 50;

const linkDeviceModalQuery = graphql`
  query linkDeviceModalQuery($search: String, $first: Int!, $filter: DeviceFilterInput) {
    devices(search: $search, first: $first, filter: $filter) {
      edges {
        node {
          ...linkMachineFields_machine
        }
      }
    }
  }
`;

const linkDeviceModalMutation = graphql`
  mutation linkDeviceModalMutation($input: LinkDirectoryDeviceInput!) {
    linkDirectoryDevice(input: $input) {
      device {
        id
      }
      userErrors {
        message
      }
    }
  }
`;

// Not the Devices list's default: linkDirectoryDevice answers NOT_FOUND for a PENDING_DELETION machine, as for a
// DELETED, ARCHIVED or DECOMMISSIONED one, and takes every other status, a still-enrolling PENDING one included.
// Built when the list renders: whether MANAGED goes out is answered after the app starts.
const machineFilter = () =>
  toRelayDeviceFilter({
    statuses: [
      DeviceStatus.PENDING,
      DeviceStatus.ACTIVE,
      DeviceStatus.INACTIVE,
      DeviceStatus.MAINTENANCE,
      DeviceStatus.MANAGED,
    ],
  });
const LINK_FAILED = 'Could not link the device';

/** The directory record being linked. */
export interface LinkRecord {
  id: string;
  name: string;
  /** "Entra ID": what the modal calls the record. */
  origin: string;
  /** Best first (D24); the first is preselected. */
  suggestions: readonly LinkMachine[];
}

function MachineRow({ machine, suggested }: { machine: LinkMachine; suggested: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-[var(--spacing-system-xs)] p-[var(--spacing-system-xs)]">
      <RadioGroupItem value={machine.machineId} aria-label={machine.name} />
      <DeviceConnectivityIcon connectivity={machine.connectivity} lastSeen={machine.lastSeen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
          <TruncateText>{machine.name}</TruncateText>
          {suggested && <Tag label="Suggested" variant="primary" className="shrink-0" />}
        </div>
        {machine.summary && (
          <TruncateText variant="h6" tone="secondary">
            {machine.summary}
          </TruncateText>
        )}
        <TruncateText variant="h6" tone="secondary">
          {machine.facts}
        </TruncateText>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-[var(--spacing-system-xxs)]">
        <DeviceLifecycleTag status={machine.status} />
        {machine.lastSeen && (
          <span className="text-ods-text-secondary text-h6">{formatRelativeTime(machine.lastSeen)}</span>
        )}
      </div>
    </label>
  );
}

function MachineList({
  machines,
  suggestedIds,
  value,
  onChange,
}: {
  machines: readonly LinkMachine[];
  suggestedIds: ReadonlySet<string>;
  value: string | null;
  onChange: (machineId: string) => void;
}) {
  if (machines.length === 0) {
    return <p className="p-[var(--spacing-system-m)] text-center text-ods-text-secondary text-h6">No devices found.</p>;
  }
  return (
    <RadioGroup
      value={value ?? ''}
      onValueChange={onChange}
      className="max-h-[20rem] gap-0 divide-y divide-ods-border overflow-y-auto rounded-md border border-ods-border bg-ods-card"
    >
      {machines.map(machine => (
        <MachineRow key={machine.machineId} machine={machine} suggested={suggestedIds.has(machine.machineId)} />
      ))}
    </RadioGroup>
  );
}

interface MachineOptionsProps {
  suggestions: readonly LinkMachine[];
  value: string | null;
  onChange: (machine: LinkMachine | null) => void;
  search: string;
}

function MachineOptions({ suggestions, value, onChange, search }: MachineOptionsProps) {
  const retryKey = useRetryKey();
  const { devices } = useLazyLoadQuery<LinkDeviceQueryType>(
    linkDeviceModalQuery,
    { search: search || null, first: MACHINES_LIMIT, filter: machineFilter() },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  const results = devices.edges.map(edge => toLinkMachine(edge.node));
  const suggestedIds = new Set(suggestions.map(machine => machine.machineId));
  // The suggestions lead. A search narrows them too: a machine the search does not name is not offered.
  const found = new Set(results.map(machine => machine.machineId));
  const machines = [
    ...suggestions.filter(machine => !search || found.has(machine.machineId)),
    ...results.filter(machine => !suggestedIds.has(machine.machineId)),
  ];
  // A search that hides the picked machine drops the pick: Link must not link a machine the list no longer shows. The
  // prop indirection is deliberate: what the list shows is this island's answer and the pick is the modal's, and a
  // child cannot set its parent's state while it renders, so the drop follows the commit.
  const pickHidden = value !== null && !machines.some(machine => machine.machineId === value);
  useEffect(() => {
    if (pickHidden) onChange(null);
  }, [pickHidden, onChange]);
  return (
    <MachineList
      machines={machines}
      suggestedIds={suggestedIds}
      value={value}
      onChange={machineId => {
        const machine = machines.find(item => item.machineId === machineId);
        if (machine) onChange(machine);
      }}
    />
  );
}

/** In a loading scope (its boundary's fallback) the suggestions are all it has: they are drawn, the rest waits. */
function MachineOptionsBody(props: MachineOptionsProps) {
  const { suggestions, value, onChange } = props;
  if (useLoadingScope()) {
    return (
      <MachineList
        machines={suggestions}
        suggestedIds={new Set(suggestions.map(machine => machine.machineId))}
        value={value}
        onChange={machineId => {
          const machine = suggestions.find(item => item.machineId === machineId);
          if (machine) onChange(machine);
        }}
      />
    );
  }
  return <MachineOptions {...props} />;
}

function MachineOptionsIsland(props: MachineOptionsProps) {
  return (
    <LoadingSuspense label="Loading devices">
      <MachineOptionsBody {...props} />
    </LoadingSuspense>
  );
}

interface LinkDeviceModalProps {
  record: LinkRecord;
  onClose: () => void;
  /** The link landed: the tab reads the account's devices again. */
  onLinked: () => void;
}

/** Mounted per record, so the picked machine and the search start over. */
export function LinkDeviceModal({ record, onClose, onLinked }: LinkDeviceModalProps) {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const debounced = useDebounce(input.trim(), 300);
  // A new search re-suspends the list: deferred, it keeps the last answer until the next one lands.
  const search = useDeferredValue(debounced);
  const [picked, setPicked] = useState<LinkMachine | null>(record.suggestions[0] ?? null);
  const [commit, isLinking] = useMutation<LinkDeviceMutationType>(linkDeviceModalMutation);

  const handleLink = () => {
    if (!picked) return;
    commit({
      variables: { input: { orgDeviceId: record.id, machineId: picked.machineId } },
      onCompleted: ({ linkDirectoryDevice: { userErrors } }) => {
        if (userErrors.length > 0) {
          toast({
            title: LINK_FAILED,
            description: userErrors.map(error => error.message).join(', '),
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: 'Device linked',
          description: `${record.name} is linked to ${picked.name}.`,
          variant: 'success',
        });
        onLinked();
      },
      onError: error => {
        toast({
          title: LINK_FAILED,
          description: getRelayErrorMessage(error, 'Try again in a moment.'),
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <SimpleModal
      isOpen
      onClose={onClose}
      title={`Link ${record.name}`}
      className="md:max-w-[600px]"
      contentClassName="flex flex-col gap-[var(--spacing-system-m)]"
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="accent"
            onClick={handleLink}
            disabled={!picked || isLinking}
            loading={isLinking}
            className="flex-1"
          >
            Link Device
          </Button>
        </>
      }
    >
      <p className="text-ods-text-primary text-h4">{`Pick the OpenFrame device this ${record.origin} record belongs to.`}</p>
      <SearchInput value={input} onChange={setInput} placeholder="Search for Devices" />
      {/* A failed read costs the whole list, suggestions too, so it drops the pick: Link links only what is shown. */}
      <ContentErrorBoundary
        onError={() => setPicked(null)}
        fallback={retry => <SectionLoadError message="Couldn't read the devices." onRetry={retry} />}
      >
        <MachineOptionsIsland
          suggestions={record.suggestions}
          value={picked?.machineId ?? null}
          onChange={setPicked}
          search={search}
        />
      </ContentErrorBoundary>
    </SimpleModal>
  );
}
