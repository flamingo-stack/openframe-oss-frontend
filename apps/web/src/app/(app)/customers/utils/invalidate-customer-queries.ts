import type { QueryClient } from '@tanstack/react-query';
import { dashboardQueryKeys } from '../../dashboard/utils/query-keys';
import { customerDetailsQueryKeys } from '../hooks/use-customer-details';
import { customersQueryKeys } from '../hooks/use-customers';

/**
 * Every cache that renders this customer: the lists, the dashboard counters
 * and, in edit mode, its own record. Awaited by the callers before they
 * navigate so the next page re-fetches instead of showing the stale copy.
 */
export async function invalidateCustomerQueries(queryClient: QueryClient, organizationId: string | null) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: customersQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: dashboardQueryKeys.all }),
    ...(organizationId
      ? [queryClient.invalidateQueries({ queryKey: customerDetailsQueryKeys.detail(organizationId) })]
      : []),
  ]);
}
