'use client';

import { NotFoundError } from '@flamingo-stack/openframe-frontend-core';
import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useLazyLoadQuery } from 'react-relay';
import type { softwareAutoUpdateViewQuery as SoftwareAutoUpdateViewQueryType } from '@/__generated__/softwareAutoUpdateViewQuery.graphql';
import { useRetryKey } from '@/app/components/shared';
import { type SoftwareAutoUpdateTitle, SoftwareAutoUpdateForm } from './software-auto-update-form';

const softwareAutoUpdateViewQuery = graphql`
  query softwareAutoUpdateViewQuery($id: ID!) {
    software(id: $id) {
      id
      name
      os
    }
    softwareAutoUpdatePolicy(softwareId: $id) {
      ...softwareAutoUpdateForm_policy
    }
  }
`;

/**
 * One title's Auto-update settings (design 1569:1890): whether new versions are installed as they come out, what an
 * update does where the app is open, and on which devices. Read first, the form is drawn meanwhile with its controls
 * locked.
 */
export function SoftwareAutoUpdateView({ softwareId, loading = false }: { softwareId: string; loading?: boolean }) {
  return (
    <LoadingSuspense live gated={loading} label="Loading auto-update">
      <SoftwareAutoUpdateReader softwareId={softwareId} />
    </LoadingSuspense>
  );
}

function SoftwareAutoUpdateReader({ softwareId }: { softwareId: string }) {
  if (useLoadingScope()) {
    return <SoftwareAutoUpdateForm softwareId={softwareId} title={null} os={null} loading />;
  }
  return <SoftwareAutoUpdateQuery softwareId={softwareId} />;
}

function SoftwareAutoUpdateQuery({ softwareId }: { softwareId: string }) {
  const retryKey = useRetryKey();
  const { software, softwareAutoUpdatePolicy } = useLazyLoadQuery<SoftwareAutoUpdateViewQueryType>(
    softwareAutoUpdateViewQuery,
    { id: softwareId },
    // Read from the server on every visit, never drawn from the store first: the form takes the saved settings once,
    // when it mounts, so opening on a cached policy (the one read before the last Save) showed the old deadline and
    // countdown, and the next Save wrote them back.
    { fetchPolicy: 'network-only', fetchKey: retryKey },
  );
  if (!software) return <NotFoundError message="Software not found" />;
  const title: SoftwareAutoUpdateTitle = { name: software.name, policy: softwareAutoUpdatePolicy };
  return <SoftwareAutoUpdateForm softwareId={software.id} title={title} os={software.os ?? null} />;
}
