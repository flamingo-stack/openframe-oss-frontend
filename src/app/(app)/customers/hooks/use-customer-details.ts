'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { queryState } from '@/lib/query-state';
import { GET_ORGANIZATION_BY_ORGANIZATION_ID_QUERY } from '../queries/customers-queries';

export interface CustomerDetails {
  id: string;
  organizationId: string;
  name: string;
  industry: string;
  website: string;
  employees: number | null;
  updatedAt: string;
  physicalAddress: string;
  mailingAddress: string;
  primary: { name: string; title: string; email: string; phone: string };
  billing: { name: string; title: string; email: string; phone: string };
  technical: { name: string; title: string; email: string; phone: string };
  mrrUsd: number | null;
  contractStart: string | null;
  contractEnd: string | null;
  notes: string[];
  isDefault: boolean;
  imageUrl?: string | null;
  imageHash?: string | null;
  status: string;
}

/**
 * The organization node as the legacy `/api/graphql` route returns it. Declared
 * here rather than generated because this query is one of the raw-POST holdouts
 * (see CLAUDE.md on the Relay migration) — every field the mapper below reads,
 * and nothing else.
 */
interface OrganizationAddressNode {
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

interface OrganizationContactNode {
  contactName?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface OrganizationNode {
  id: string;
  organizationId: string;
  name?: string | null;
  category?: string | null;
  websiteUrl?: string | null;
  numberOfEmployees?: number | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  monthlyRevenue?: number | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  notes?: string | null;
  isDefault?: boolean | null;
  status?: string | null;
  image?: { imageUrl?: string | null; hash?: string | null } | null;
  contactInformation?: {
    physicalAddress?: OrganizationAddressNode | null;
    mailingAddress?: OrganizationAddressNode | null;
    contacts?: OrganizationContactNode[] | null;
  } | null;
}

function formatAddress(addr?: OrganizationAddressNode | null): string {
  if (!addr) return '';
  const parts = [addr.street1, addr.street2, addr.city, addr.state, addr.postalCode, addr.country];
  return parts.filter(Boolean).join(', ');
}

function mapOrganization(org: OrganizationNode): CustomerDetails {
  const contacts: OrganizationContactNode[] = Array.isArray(org.contactInformation?.contacts)
    ? org.contactInformation.contacts
    : [];
  const primary: OrganizationContactNode = contacts[0] || {};
  const billing: OrganizationContactNode = contacts[1] || {};
  const technical: OrganizationContactNode = contacts[2] || {};

  return {
    id: org.id,
    organizationId: org.organizationId,
    name: org.name || '-',
    industry: org.category || '-',
    website: org.websiteUrl || '-',
    employees: typeof org.numberOfEmployees === 'number' ? org.numberOfEmployees : null,
    updatedAt: org.updatedAt || org.createdAt || new Date().toISOString(),
    physicalAddress: formatAddress(org.contactInformation?.physicalAddress),
    mailingAddress: formatAddress(org.contactInformation?.mailingAddress),
    primary: {
      name: primary.contactName || '',
      title: primary.title || '',
      email: primary.email || '',
      phone: primary.phone || '',
    },
    billing: {
      name: billing.contactName || '',
      title: billing.title || '',
      email: billing.email || '',
      phone: billing.phone || '',
    },
    technical: {
      name: technical.contactName || '',
      title: technical.title || '',
      email: technical.email || '',
      phone: technical.phone || '',
    },
    mrrUsd: typeof org.monthlyRevenue === 'number' ? org.monthlyRevenue : null,
    contractStart: org.contractStartDate || null,
    contractEnd: org.contractEndDate || null,
    notes: org.notes ? [org.notes] : [],
    isDefault: org.isDefault || false,
    imageUrl: org.image?.imageUrl,
    imageHash: org.image?.hash,
    status: org.status || 'ACTIVE',
  };
}

export const customerDetailsQueryKeys = {
  all: ['organization-detail'] as const,
  detail: (id: string) => ['organization-detail', id] as const,
};

async function fetchCustomer(id: string): Promise<CustomerDetails> {
  const response = await apiClient.post<{ data?: { organizationByOrganizationId?: OrganizationNode | null } }>(
    '/api/graphql',
    {
      query: GET_ORGANIZATION_BY_ORGANIZATION_ID_QUERY,
      variables: { organizationId: id },
    },
  );

  if (!response.ok) {
    throw new Error(response.error || `Request failed with status ${response.status}`);
  }

  const org = response.data?.data?.organizationByOrganizationId;
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
