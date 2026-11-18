'use client';

import { NotFoundError } from '@flamingo-stack/openframe-frontend-core';
import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { PACKAGE_MANAGER_OS } from '@flamingo-stack/openframe-frontend-core/components/features';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { softwareTitleUpdateViewQuery as SoftwareTitleUpdateViewQueryType } from '@/__generated__/softwareTitleUpdateViewQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { SoftwareAction } from '@/generated/schema-enums';
import { SoftwareDetailSummary } from '../software-detail/software-detail-summary';
import { SoftwareActionView } from './software-action-view';

const softwareTitleUpdateViewQuery = graphql`
  query softwareTitleUpdateViewQuery($id: ID!) {
    software(id: $id) {
      id
      name
      os
      ...softwareDetailSummary_software
    }
  }
`;

/** Every system a package manager runs on: the picker's frame for a title of no one system. */
const PACKAGE_MANAGER_SYSTEMS = [...new Set(Object.values(PACKAGE_MANAGER_OS))];

/** What the heading reads before the title answers: "Update Software", the form's own name. */
const LOADING_NAME = 'Software';

/**
 * Update <software> from the software's page (design 1577:3): the title's card in place of the package rows, the
 * devices it is on, and the server picks the package that manages it on each one. The title is read first, the form
 * is drawn meanwhile with its controls locked.
 */
export function SoftwareTitleUpdateView({ softwareId, loading = false }: { softwareId: string; loading?: boolean }) {
  return (
    <LoadingSuspense live gated={loading} label="Loading software">
      <SoftwareTitleUpdateReader softwareId={softwareId} />
    </LoadingSuspense>
  );
}

function SoftwareTitleUpdateReader({ softwareId }: { softwareId: string }) {
  if (useLoadingScope()) {
    return (
      <SoftwareActionView
        action={SoftwareAction.UPDATE}
        loading
        software={{
          id: softwareId,
          name: LOADING_NAME,
          osTypes: PACKAGE_MANAGER_SYSTEMS,
          summary: <SoftwareDetailSummary software={null} />,
        }}
      />
    );
  }
  return <SoftwareTitleUpdateQuery softwareId={softwareId} />;
}

function SoftwareTitleUpdateQuery({ softwareId }: { softwareId: string }) {
  const retryKey = useRetryKey();
  const { software } = useLazyLoadQuery<SoftwareTitleUpdateViewQueryType>(
    softwareTitleUpdateViewQuery,
    { id: softwareId },
    { fetchPolicy: 'store-or-network', fetchKey: retryKey },
  );
  if (!software) return <NotFoundError message="Software not found" />;
  return (
    <SoftwareActionView
      action={SoftwareAction.UPDATE}
      software={{
        id: software.id,
        name: software.name,
        osTypes: software.os ? [software.os] : PACKAGE_MANAGER_SYSTEMS,
        summary: <SoftwareDetailSummary software={software} />,
      }}
    />
  );
}
