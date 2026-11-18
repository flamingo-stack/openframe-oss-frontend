'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { graphql, useMutation } from 'react-relay';
import type { useAdoptSoftwareMutation as AdoptMutationType } from '@/__generated__/useAdoptSoftwareMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { pluralize } from '@/lib/pluralize';
import { routes } from '@/lib/routes';

/** Returns the devices the order went to; a device its package manager cannot run on is left out. */
const adoptMutation = graphql`
  mutation useAdoptSoftwareMutation($input: AdoptSoftwareInput!) {
    adoptSoftware(input: $input)
  }
`;

/**
 * Adopt: sends the title's adoption order to the chosen devices, then back to the title's Devices tab, where they show
 * ADOPTING. The order changes what the Devices tab, the banner and Software Actions read, none of which this answer
 * carries, so the store is marked stale and each refetches when it is next shown.
 */
export function useAdoptSoftware(software: { id: string; name: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [commit, isInFlight] = useMutation<AdoptMutationType>(adoptMutation);
  // Answered, the page has not left yet: the button stays busy instead of re-arming.
  const [isLeaving, setLeaving] = useState(false);

  const adopt = (machineIds: string[]) => {
    if (machineIds.length === 0) {
      toast({
        title: 'No devices selected',
        description: 'Please select at least one device.',
        variant: 'destructive',
      });
      return;
    }
    commit({
      variables: { input: { softwareId: software.id, machineIds } },
      updater: store => store.invalidateStore(),
      onCompleted: response => {
        const sent = response.adoptSoftware.length;
        const skipped = machineIds.length - sent;
        toast({
          title: 'Adoption started',
          description: `${software.name} on ${pluralize(sent, 'device')}.${skipped > 0 ? ` ${pluralize(skipped, 'device')} left out: its package manager cannot run there.` : ''}`,
          variant: 'success',
        });
        setLeaving(true);
        router.push(routes.software.details(software.id, { tab: 'devices' }));
      },
      onError: error => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to start the adoption'),
          variant: 'destructive',
        });
      },
    });
  };

  return { adopt, isAdopting: isInFlight || isLeaving };
}
