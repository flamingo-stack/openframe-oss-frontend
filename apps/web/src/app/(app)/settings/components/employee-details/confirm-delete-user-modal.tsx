'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useRouter } from 'next/navigation';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { confirmDeleteUserModal_user$key } from '@/__generated__/confirmDeleteUserModal_user.graphql';
import type { confirmDeleteUserModalMutation } from '@/__generated__/confirmDeleteUserModalMutation.graphql';
import { ConfirmDialog } from '@/app/components/shared/confirm-dialog';
import { toUserSummary } from '@/graphql/users/user-summary-fields';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';

const confirmDeleteUserModalFragment = graphql`
  fragment confirmDeleteUserModal_user on User {
    id
    ...userSummaryFields_user
  }
`;

const confirmDeleteUserModalMutationNode = graphql`
  mutation confirmDeleteUserModalMutation($id: ID!) {
    deleteUser(input: { id: $id }) {
      # All an admin's delete changes: every surface reads the status from the same User record.
      user {
        id
        status
      }
    }
  }
`;

interface ConfirmDeleteUserModalProps {
  user: confirmDeleteUserModal_user$key;
  isOpen: boolean;
  onClose: () => void;
}

/** Deletes another user (soft delete: DELETED) and returns to the list. */
export function ConfirmDeleteUserModal({ user, isOpen, onClose }: ConfirmDeleteUserModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const data = useFragment(confirmDeleteUserModalFragment, user);
  const { name } = toUserSummary(data);
  const [commit, isInFlight] = useMutation<confirmDeleteUserModalMutation>(confirmDeleteUserModalMutationNode);

  const handleConfirm = () => {
    commit({
      variables: { id: data.id },
      onCompleted: () => {
        toast({ title: 'Employee deleted', description: `${name} was deleted`, variant: 'success' });
        onClose();
        router.push(routes.settings.employees);
      },
      onError: error => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to delete user'),
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      title="Confirm Deletion"
      description={
        <>
          Confirm the deletion of the <span className="text-ods-error">{name}</span> user. This user will no longer have
          access to the system.
        </>
      }
      confirmLabel="Delete User"
      isPending={isInFlight}
      onConfirm={handleConfirm}
    />
  );
}
