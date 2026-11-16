'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useEffect, useRef, useState } from 'react';
import { commitMutation, graphql, useRelayEnvironment } from 'react-relay';
import type { useSeededBundleAddMutation as AddMutationType } from '@/__generated__/useSeededBundleAddMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { toGlobalId } from '@/lib/relay-id';

/** The devices of the saved policy, put on the draft; the answer moves the draft's count the form reads. */
const addMutation = graphql`
  mutation useSeededBundleAddMutation($bundleId: ID!, $machineIds: [ID!]!) {
    addDevicesToSoftwareBundle(bundleId: $bundleId, machineIds: $machineIds) {
      id
      ...useDraftBundle_bundle
    }
  }
`;

export type SeedState = 'seeding' | 'seeded';

/**
 * Puts `machineIds` (`Machine.machineId`, as the auto-update policy lists them) on the draft once it is open, so the
 * page opens on the devices the policy is on. 'seeded' with nothing to put on it, and also when the server refuses:
 * the picker then opens on what the draft holds, and a toast says the saved devices could not be loaded, so the
 * user picks them again rather than saving a policy that silently drops them.
 */
export function useSeededBundle(bundleId: string | null, machineIds: ReadonlyArray<string>): SeedState {
  const environment = useRelayEnvironment();
  const { toast } = useToast();
  const [seededId, setSeededId] = useState<string | null>(null);
  const startedRef = useRef<string | null>(null);
  const empty = machineIds.length === 0;
  // Joined: the parent hands a new array on every render, the effect runs once per draft.
  const idsKey = machineIds.join(',');

  useEffect(() => {
    if (!bundleId || empty || startedRef.current === bundleId) return;
    startedRef.current = bundleId;
    const done = () => setSeededId(bundleId);
    commitMutation<AddMutationType>(environment, {
      mutation: addMutation,
      variables: { bundleId, machineIds: idsKey.split(',').map(id => toGlobalId('Machine', id)) },
      onCompleted: done,
      onError: error => {
        toast({
          title: 'Saved devices not loaded',
          description: getRelayErrorMessage(error, 'Select the devices to keep updated again.'),
          variant: 'destructive',
        });
        done();
      },
    });
  }, [bundleId, empty, idsKey, environment, toast]);

  if (empty) return 'seeded';
  return bundleId && seededId === bundleId ? 'seeded' : 'seeding';
}
