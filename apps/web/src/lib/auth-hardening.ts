import { queryOptions } from '@tanstack/react-query';
import { isSaasTenantMode, isSharedAuthUi } from './app-mode';
import { authApiClient } from './auth-api-client';

const AUTH_HARDENING_TIMEOUT_MS = 10_000;

/** Reads the signup and sign-in contract offered by Shared Auth. */
export async function readAuthHardening(signal?: AbortSignal): Promise<boolean> {
  if (!isSharedAuthUi() && !isSaasTenantMode()) return false;

  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, AUTH_HARDENING_TIMEOUT_MS);
  try {
    const response = await authApiClient.getAuthHardening(controller.signal);
    if (response.status === 404) return false;
    if (!response.ok || typeof response.data?.enabled !== 'boolean') {
      throw new Error('Could not check which sign-in options are available.');
    }
    return response.data.enabled;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}

export const authHardeningQueryOptions = () =>
  queryOptions({
    queryKey: ['auth-hardening'],
    queryFn: ({ signal }) => readAuthHardening(signal),
    // Keep the chosen contract for this form, then read it again for a new flow.
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
