'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authSessionQueryKey } from '@/app/(auth)/auth/hooks/use-auth-session';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { forceLogout } from '@/lib/force-logout';
import { handleApiError } from '@/lib/handle-api-error';
import { routes } from '@/lib/routes';
import { deleteUserApi } from './use-users';

/**
 * The `/account-deleted` page renders after the session is gone, so the one
 * piece of context it shows — the organization name — is stashed here right
 * before logout. sessionStorage on purpose: it survives the `router.replace`
 * but not a new tab or browser restart, so the page degrades to generic copy
 * instead of echoing a stale organization forever.
 */
export const DELETED_ACCOUNT_ORG_STORAGE_KEY = 'of-deleted-account-org';

async function transferOwnershipApi(newOwnerId: string): Promise<void> {
  const res = await apiClient.post(`/api/users/${encodeURIComponent(newOwnerId)}/transfer-ownership`);
  if (!res.ok) {
    throw new Error(res.error || `Failed to transfer ownership (${res.status})`);
  }
}

/**
 * Self-deletion of the signed-in user's account.
 *
 * Owners must hand the OWNER role to another ACTIVE user first — the backend
 * 403s a delete while the target still holds OWNER — so the mutation takes an
 * optional `newOwnerId` and runs transfer-ownership before the delete. The two
 * calls are sequential, not atomic: if the delete fails after a successful
 * transfer, the caller has already become ADMIN and stays signed in; the error
 * toast covers it and a retry (now without a transfer step) is the recovery.
 *
 * On success the account is SELF_DELETED server-side and every credential is
 * dead, so this signs out locally (no server round-trip — the session is
 * already invalid) and replaces onto the standalone `/account-deleted` page.
 * `replace` keeps the app out of history; pressing Back lands on a guarded
 * app route, which redirects a signed-out visitor to /auth.
 */
export function useDeleteOwnAccount() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const user = useAuthStore(state => state.user);

  return useMutation({
    mutationFn: async ({ newOwnerId }: { newOwnerId?: string }) => {
      if (!user?.id) throw new Error('No authenticated user');
      if (newOwnerId) {
        await transferOwnershipApi(newOwnerId);
      }
      await deleteUserApi(user.id);
    },
    onSuccess: async () => {
      try {
        sessionStorage.setItem(DELETED_ACCOUNT_ORG_STORAGE_KEY, user?.organizationName ?? '');
      } catch {
        // Storage unavailable (private mode quirks) — the page falls back to generic copy.
      }
      await forceLogout({ shouldRedirect: false });
      queryClient.setQueryData(authSessionQueryKey, null);
      router.replace(routes.accountDeleted);
    },
    onError: err => handleApiError(err, toast, 'Failed to delete account'),
  });
}
