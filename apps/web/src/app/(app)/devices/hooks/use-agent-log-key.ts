'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/**
 * The tenant's agent log key, which the install and register commands pass as
 * `--logKey` so a device's logs stream authenticates with it from the first
 * connect instead of with the install key.
 *
 * The flag is optional: without it the device streams logs with the install
 * key until it registers and fetches the log key itself. So every failure -
 * the 404 `AGENT_LOG_KEY_NOT_FOUND` of a tenant with no key yet included -
 * leaves it out without a toast, there is nothing for the user to act on; and
 * nothing waits for the answer, which is why there are no retries.
 */
export function useAgentLogKey(): string | undefined {
  const { data } = useQuery({
    queryKey: ['agent', 'log-key'],
    queryFn: async () => {
      const response = await apiClient.get<{ key?: string }>('/api/agent/log-key');
      if (!response.ok) {
        throw new Error(response.error || `Request failed with status ${response.status}`);
      }
      return response.data?.key ?? null;
    },
    // One key per tenant, never rotated.
    staleTime: Infinity,
    retry: false,
  });

  return data ?? undefined;
}
