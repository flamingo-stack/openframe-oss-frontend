'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/**
 * The tenant's agent log key, which the install and register commands pass as
 * `--logKey` so a device's logs stream authenticates with it from the first
 * connect instead of with the install key.
 *
 * The flag is optional: without it the device streams logs with the install
 * key until it registers and fetches the log key itself. So a failure leaves
 * it out without a toast, there is nothing for the user to act on, and nothing
 * waits for the answer. A 4xx - the 404 `AGENT_LOG_KEY_NOT_FOUND` of a tenant
 * with no key yet included - is the answer and settles on no key; no answer
 * or a 5xx is retried, so a blip at mount does not drop the flag for the visit.
 */
export function useAgentLogKey(): string | undefined {
  const { data } = useQuery({
    queryKey: ['agent', 'log-key'],
    queryFn: async () => {
      const response = await apiClient.get<{ key?: string }>('/api/agent/log-key');
      if (response.ok) return response.data?.key ?? null;
      if (response.status >= 400 && response.status < 500) return null;
      throw new Error(response.error || `Request failed with status ${response.status}`);
    },
    // One key per tenant, never rotated.
    staleTime: Infinity,
    retry: 2,
  });

  return data ?? undefined;
}
