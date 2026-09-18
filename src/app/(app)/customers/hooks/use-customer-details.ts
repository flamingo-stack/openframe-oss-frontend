'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryState } from '@/lib/query-state';
import { GET_ORGANIZATION_BY_ORGANIZATION_ID_QUERY } from '../queries/customers-queries';
import { type CustomerDetails, mapOrganization, type OrganizationNode } from '../utils/map-organization';

export type { CustomerContactSlot, CustomerDetails } from '../utils/map-organization';

export const customerDetailsQueryKeys = {
  all: ['organization-detail'] as const,
  detail: (id: string) => ['organization-detail', id] as const,
};

interface OrganizationDetailsResponse {
  data?: { organizationByOrganizationId?: OrganizationNode | null };
  errors?: Array<{ message?: string }>;
}

async function fetchCustomer(id: string): Promise<CustomerDetails> {
  const response = await apiClient.post<OrganizationDetailsResponse>('/api/graphql', {
    query: GET_ORGANIZATION_BY_ORGANIZATION_ID_QUERY,
    variables: { organizationId: id },
  });

  if (!response.ok) {
    throw new Error(response.error || `Request failed with status ${response.status}`);
  }

  // A GraphQL error can arrive next to a partial record (a non-null field nulled
  // out along with its parent). Seeding the edit form from that partial record
  // and saving would overwrite the real customer with blanks — so an error is a
  // load failure, never a record.
  const graphqlResponse = response.data;
  if (graphqlResponse?.errors && graphqlResponse.errors.length > 0) {
    throw new Error(graphqlResponse.errors[0].message || 'GraphQL error occurred');
  }

  const org = graphqlResponse?.data?.organizationByOrganizationId;
  if (!org) {
    throw new Error('Customer not found');
  }

  return mapOrganization(org);
}

export function useCustomerDetails(id?: string | null) {
  const query = useQuery({
    queryKey: customerDetailsQueryKeys.detail(id || ''),
    queryFn: id ? () => fetchCustomer(id) : skipToken,
  });

  return {
    organization: query.data ?? null,
    // `gate: 'closed'` when there is no id: the query will never run, so it must
    // report idle rather than "loading forever".
    ...queryState(query, id ? 'open' : 'closed'),
    refetch: query.refetch,
  };
}
