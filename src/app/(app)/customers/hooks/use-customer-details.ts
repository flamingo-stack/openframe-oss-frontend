'use client';

import { useLazyLoadQuery } from 'react-relay';
import { graphql } from 'relay-runtime';
import { queryState } from '@/lib/query-state';

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

function formatAddress(addr?: any): string {
  if (!addr) return '';
  const parts = [addr.street1, addr.street2, addr.city, addr.state, addr.postalCode, addr.country];
  return parts.filter(Boolean).join(', ');
}

function mapOrganization(org: any): CustomerDetails {
  const contacts = Array.isArray(org.contactInformation?.contacts) ? org.contactInformation.contacts : [];
  const primary = contacts[0] || {};
  const billing = contacts[1] || {};
  const technical = contacts[2] || {};

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

const useCustomerDetailsQuery = graphql`
  query useCustomerDetailsQuery($organizationId: String!, $skip: Boolean!) {
    organizationByOrganizationId(organizationId: $organizationId) @skip(if: $skip) {
      id
      organizationId
      name
      category
      websiteUrl
      numberOfEmployees
      updatedAt
      createdAt
      monthlyRevenue
      contractStartDate
      contractEndDate
      notes
      isDefault
      status
      image {
        imageUrl
        hash
      }
      contactInformation {
        physicalAddress {
          street1
          street2
          city
          state
          postalCode
          country
        }
        mailingAddress {
          street1
          street2
          city
          state
          postalCode
          country
        }
        contacts {
          contactName
          title
          email
          phone
        }
      }
    }
  }
`;

export function useCustomerDetails(id?: string | null) {
  const data = useLazyLoadQuery<any>(useCustomerDetailsQuery, {
    organizationId: id || '',
    skip: !id,
  });

  const org = data?.organizationByOrganizationId;
  const organization = org ? mapOrganization(org) : null;

  const query = {
    data: organization,
    isLoading: false,
    isError: false,
    error: null,
  };

  return {
    organization: organization ?? null,
    // `gate: 'closed'` when there is no id: the query will never run, so it must
    // report idle rather than "loading forever".
    ...queryState(query as any, id ? 'open' : 'closed'),
    refetch: () => {},
  };
}
