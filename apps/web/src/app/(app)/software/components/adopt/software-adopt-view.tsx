'use client';

import { NotFoundError } from '@flamingo-stack/openframe-frontend-core';
import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  type PageActionButton,
  PageLayout,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { adoptPackageRow_software$key } from '@/__generated__/adoptPackageRow_software.graphql';
import type { softwareAdoptViewQuery as SoftwareAdoptViewQueryType } from '@/__generated__/softwareAdoptViewQuery.graphql';
import type { Device } from '@/app/(app)/devices/types/device.types';
import { EmptyState, noop, useRetryKey } from '@/app/components/shared';
import { useSafeBack } from '@/app/hooks/use-safe-back';
import { routes } from '@/lib/routes';
import { AdoptDevicePicker, adoptDeviceKey } from './adopt-device-picker';
import { AdoptPackageRow } from './adopt-package-row';
import { ADOPT_DEVICE_LIMIT } from './adoptable-devices';
import { useAdoptSoftware } from './use-adopt-software';

const softwareAdoptViewQuery = graphql`
  query softwareAdoptViewQuery($id: ID!) {
    software(id: $id) {
      id
      name
      # Whether there is a package at all; the row reads which.
      adoptionPackage {
        __typename
      }
      ...adoptPackageRow_software
    }
  }
`;

/** What the heading reads before the title answers. */
const LOADING_NAME = 'Software';

/**
 * Adopt <software> (designs 1227:569, 1634:9683, 1227:45274): reinstall a title that was installed by hand with a
 * package manager, so OpenFrame can update it later. The title is read first; meanwhile the page draws with its
 * controls locked.
 */
export function SoftwareAdoptView({ softwareId, loading = false }: { softwareId: string; loading?: boolean }) {
  return (
    <LoadingSuspense live gated={loading} label="Loading software">
      <SoftwareAdoptReader softwareId={softwareId} />
    </LoadingSuspense>
  );
}

function SoftwareAdoptReader({ softwareId }: { softwareId: string }) {
  if (useLoadingScope()) {
    return (
      <SoftwareAdoptForm software={{ id: softwareId, name: LOADING_NAME, hasPackage: false, row: null }} loading />
    );
  }
  return <SoftwareAdoptQuery softwareId={softwareId} />;
}

function SoftwareAdoptQuery({ softwareId }: { softwareId: string }) {
  const retryKey = useRetryKey();
  const { software } = useLazyLoadQuery<SoftwareAdoptViewQueryType>(
    softwareAdoptViewQuery,
    { id: softwareId },
    { fetchPolicy: 'store-and-network', fetchKey: retryKey },
  );
  if (!software) return <NotFoundError message="Software not found" />;
  return (
    <SoftwareAdoptForm
      software={{ id: software.id, name: software.name, hasPackage: !!software.adoptionPackage, row: software }}
    />
  );
}

interface AdoptTitle {
  id: string;
  name: string;
  /** The title has a package the server adopts it with. */
  hasPackage: boolean;
  /** What the package row reads; null while the title is read. */
  row: adoptPackageRow_software$key | null;
}

function SoftwareAdoptForm({ software, loading = false }: { software: AdoptTitle; loading?: boolean }) {
  const handleBack = useSafeBack(routes.software.details(software.id, { tab: 'devices' }));
  const [selected, setSelected] = useState<Device[]>([]);
  const { adopt, isAdopting } = useAdoptSoftware(software);
  const nothingToAdopt = !loading && !software.hasPackage;
  const overLimit = selected.length > ADOPT_DEVICE_LIMIT;

  const actions: PageActionButton[] = [
    { label: 'Cancel', onClick: handleBack, variant: 'outline', showOnlyMobile: true },
    {
      label: 'Adopt',
      variant: 'accent',
      onClick: () => adopt(selected.map(adoptDeviceKey)),
      disabled: loading || nothingToAdopt || selected.length === 0 || overLimit,
      loading: isAdopting,
    },
  ];

  return (
    <PageLayout
      title={`Adopt ${software.name}`}
      backButton={{ label: 'Back', onClick: handleBack }}
      actions={actions}
      actionsVariant="primary-buttons"
      className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
    >
      {nothingToAdopt ? (
        <EmptyState
          title="Nothing to adopt"
          description={`No package manager has a package to reinstall ${software.name} with, or one already manages it.`}
        />
      ) : (
        <>
          <AdoptPackageRow software={software.row} />

          {/* Design 1532:30556: with every package manager the title can take already in a row, there is none left
              to add. The server adopts with exactly one, so that is always the case. */}
          <Button
            type="button"
            variant="outline"
            size="small"
            className="self-start"
            onClick={noop}
            disabled
            leftIcon={<PlusCircleIcon size={24} className="text-ods-text-secondary" />}
          >
            Add Package Manager
          </Button>

          <h2 className="pt-[var(--spacing-system-l)] text-ods-text-primary text-h2">Device Selection</h2>
          {overLimit && (
            <p className="text-ods-error text-h6">{`One adoption takes up to ${ADOPT_DEVICE_LIMIT} devices.`}</p>
          )}
          <AdoptDevicePicker
            softwareId={software.id}
            selected={selected}
            onSelectionChange={setSelected}
            disabled={isAdopting}
          />
        </>
      )}
    </PageLayout>
  );
}
