'use client';

import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { authSessionQueryKey } from '@/app/(auth)/auth/hooks/use-auth-session';
import { useAuthStore } from '@/app/(auth)/auth/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { authApiClient } from '@/lib/auth-api-client';
import { handleApiError } from '@/lib/handle-api-error';
import { unregisterNativePush } from '@/lib/native-push';
import { isMobileShell } from '@/lib/platform';
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

/**
 * Hand-off flag between the deletion mutation and the `/account-deleted` page.
 * The mutation deliberately does NOT clear local auth state before navigating —
 * doing so re-renders the app chrome signed-out ("Sign in required") for the
 * beat it takes the navigation to land. Instead it sets this flag, and the
 * page clears tokens/store/session-cache on mount. The flag also stops a
 * direct visit to `/account-deleted` from signing out an innocent session.
 */
export const ACCOUNT_DELETED_PENDING_STORAGE_KEY = 'of-account-deleted-pending';

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
 * On success the gateway session is revoked server-side FIRST (the JWT cookie
 * is signature-validated, so it outlives the deleted account — without the
 * revoke, Back + reload could reopen the app), then the flow replaces onto the
 * standalone `/account-deleted` page. Local auth state is cleared by that page
 * on mount (see {@link ACCOUNT_DELETED_PENDING_STORAGE_KEY}) so the app chrome
 * never renders its signed-out state mid-navigation. `replace` keeps the app
 * out of history; pressing Back lands on a guarded app route, which shows the
 * mode's sign-in surface.
 */
export function useDeleteOwnAccount() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const user = useAuthStore(state => state.user);
  // Set once the transfer step commits. If the subsequent delete fails, the
  // caller is already ADMIN — a retry that repeated the transfer would 403
  // (only the owner may transfer), stranding the user. The flag makes a retry
  // skip straight to the delete, and the session invalidation in the error
  // path refreshes the owner gate so the modal drops its owner-only UI.
  const transferDoneRef = useRef(false);

  return useMutation({
    mutationFn: async ({ newOwnerId }: { newOwnerId?: string }) => {
      if (!user?.id) throw new Error('No authenticated user');
      if (newOwnerId && !transferDoneRef.current) {
        await transferOwnershipApi(newOwnerId);
        transferDoneRef.current = true;
      }
      await deleteUserApi(user.id);
    },
    onSuccess: async () => {
      try {
        sessionStorage.setItem(DELETED_ACCOUNT_ORG_STORAGE_KEY, user?.organizationName ?? '');
        sessionStorage.setItem(ACCOUNT_DELETED_PENDING_STORAGE_KEY, '1');
      } catch {
        // Storage unavailable (private mode quirks) — the page falls back to generic copy.
      }
      // Mobile shell: drop this device's FCM registration while the bearer is
      // still usable (mirrors performLogout). Best-effort.
      if (isMobileShell()) {
        try {
          await unregisterNativePush();
        } catch {
          // Best-effort.
        }
      }
      // Revoke the gateway session server-side BEFORE leaving the page. This is
      // a pure network call — no client state changes, so nothing re-renders —
      // and it's what makes Back + reload land on sign-in instead of the app.
      try {
        const { tenantId, user: storeUser } = useAuthStore.getState();
        await authApiClient.logoutAsync(tenantId || storeUser?.tenantId || storeUser?.organizationId);
      } catch {
        // Best-effort: the account is deleted server-side either way.
      }
      // No local sign-out here — the /account-deleted page does it on mount.
      router.replace(routes.accountDeleted);
    },
    onError: err => {
      handleApiError(err, toast, 'Failed to delete account');
      if (transferDoneRef.current) {
        // Ownership already moved: re-ask /me so the owner gate (and the
        // modal's owner-only UI) reflects the caller's new ADMIN role.
        queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
      }
    },
  });
}
