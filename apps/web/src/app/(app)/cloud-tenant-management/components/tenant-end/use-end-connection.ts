'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { graphql, useMutation } from 'react-relay';
import type { useEndConnectionDeleteMutation } from '@/__generated__/useEndConnectionDeleteMutation.graphql';
import type { useEndConnectionDisconnectMutation } from '@/__generated__/useEndConnectionDisconnectMutation.graphql';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { userErrorsDescription } from '../tenant-form/attribution-helpers';
import type { EndConnectionMode } from './end-connection-copy';

const disconnectMutation = graphql`
  mutation useEndConnectionDisconnectMutation($connectionId: ID!) {
    disconnectDirectoryConnection(connectionId: $connectionId) {
      connection {
        id
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`;

const deleteMutation = graphql`
  mutation useEndConnectionDeleteMutation($connectionId: ID!) {
    deleteDirectoryConnection(connectionId: $connectionId) {
      connection {
        id
      }
      userErrors {
        code
        message
        field
      }
    }
  }
`;

const FAILED_TITLE: Record<EndConnectionMode, string> = {
  disconnect: 'Could not disconnect the tenant',
  delete: 'Could not delete the connection',
};

/**
 * The button of the Disconnect and Delete pages. Both change what every tenant screen reads (the access state, the
 * list's rows and counts, the customers' bindings), so the store is invalidated: nothing read before them is shown
 * after them.
 */
export function useEndConnection(connectionId: string | null, mode: EndConnectionMode) {
  const { toast } = useToast();
  const router = useRouter();
  const [commitDisconnect, isDisconnecting] = useMutation<useEndConnectionDisconnectMutation>(disconnectMutation);
  const [commitDelete, isDeleting] = useMutation<useEndConnectionDeleteMutation>(deleteMutation);

  const failed = (description: string) => {
    toast({ title: FAILED_TITLE[mode], description, variant: 'destructive' });
  };
  const onError = (error: Error) => failed(getRelayErrorMessage(error, 'Please try again.'));

  const submit = () => {
    if (!connectionId) return;
    if (mode === 'disconnect') {
      commitDisconnect({
        variables: { connectionId },
        updater: store => store.invalidateStore(),
        onCompleted: ({ disconnectDirectoryConnection: { userErrors } }) => {
          if (userErrors.length > 0) {
            failed(userErrorsDescription(userErrors));
            return;
          }
          toast({ title: 'Tenant disconnected', description: 'What was read stays, read-only.', variant: 'success' });
          router.replace(routes.cloudTenantManagement.details(connectionId));
        },
        onError,
      });
      return;
    }
    commitDelete({
      variables: { connectionId },
      updater: store => store.invalidateStore(),
      onCompleted: ({ deleteDirectoryConnection: { userErrors } }) => {
        if (userErrors.length > 0) {
          failed(userErrorsDescription(userErrors));
          return;
        }
        toast({
          title: 'Connection deleted',
          description: 'Its users, groups and devices are gone.',
          variant: 'success',
        });
        router.replace(routes.cloudTenantManagement.list);
      },
      onError,
    });
  };

  return { submit, isSubmitting: isDisconnecting || isDeleting };
}
