'use client';

import { useMemo } from 'react';
import { runtimeEnv } from '@/lib/runtime-config';

/**
 * Resolves the OAuth redirect URL for a given SSO provider key.
 *
 * Encapsulates runtime host resolution in a hook per the codebase convention
 * (hooks/use-*.ts) rather than reading window globals directly in component
 * bodies. `runtimeEnv.sharedHostUrl()` is expected to be resolvable
 * consistently on both server and client to avoid SSR/CSR mismatches for this
 * security-sensitive value.
 */
export function useSsoRedirectUrl(providerKey: string): string {
  return useMemo(() => {
    const sharedHost = runtimeEnv.sharedHostUrl() || '';
    return `${sharedHost}/sas/login/oauth2/code/${providerKey.toLowerCase()}`;
  }, [providerKey]);
}
