'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useMutation } from 'react-relay';
import type { useUpdateOwnProfileMutation } from '@/__generated__/useUpdateOwnProfileMutation.graphql';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { getRelayErrorMessage } from '@/lib/handle-api-error';
import { toGlobalId } from '@/lib/relay-id';

const updateOwnProfileMutation = graphql`
  mutation useUpdateOwnProfileMutation($input: UpdateUserInput!) {
    updateUser(input: $input) {
      user {
        id
        firstName
        lastName
      }
    }
  }
`;

/**
 * Renames the signed-in user: toasts either way and mirrors the saved name into
 * the auth store. The promise rejects on failure, so an edit modal stays open.
 */
export function useUpdateOwnProfile() {
  const { toast } = useToast();
  const userId = useAuthStore(state => state.user?.id);
  const updateAuthUser = useAuthStore(state => state.updateUser);
  const [commit, isUpdating] = useMutation<useUpdateOwnProfileMutation>(updateOwnProfileMutation);

  const updateProfile = (profile: { firstName: string; lastName: string }) =>
    new Promise<void>((resolve, reject) => {
      if (!userId) {
        reject(new Error('No authenticated user'));
        return;
      }
      commit({
        variables: { input: { id: toGlobalId('User', userId), ...profile } },
        onCompleted: response => {
          const { firstName, lastName } = response.updateUser.user;
          updateAuthUser({ firstName: firstName ?? '', lastName: lastName ?? '' });
          toast({
            title: 'Profile Updated',
            description: 'Your profile has been updated successfully.',
            variant: 'success',
            duration: 3000,
          });
          resolve();
        },
        onError: error => {
          toast({
            title: 'Error',
            description: getRelayErrorMessage(error, 'Failed to update profile'),
            variant: 'destructive',
          });
          reject(error);
        },
      });
    });

  return { updateProfile, isUpdating };
}
