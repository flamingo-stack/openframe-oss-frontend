import type { ContactPersonDto } from '../hooks/use-create-customer';

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
  /**
   * Every contact on the record, in the order the API holds them. The edit form
   * round-trips this list whole: `PUT /api/organizations/{id}` replaces
   * `contactInformation` wholesale, so a contact this list does not carry is a
   * contact the next Save deletes.
   */
  contacts: ContactPersonDto[];
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
export interface OrganizationAddressNode {
  street1?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface OrganizationContactNode {
  contactName?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface OrganizationNode {
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

function toContactDto(contact: OrganizationContactNode): ContactPersonDto {
  return {
    contactName: contact.contactName || '',
    title: contact.title || '',
    phone: contact.phone || '',
    email: contact.email || '',
  };
}

/** Pure record → view-model mapping for the customer details/edit pages. */
export function mapOrganization(org: OrganizationNode): CustomerDetails {
  const contacts: OrganizationContactNode[] = Array.isArray(org.contactInformation?.contacts)
    ? org.contactInformation.contacts
    : [];

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
    contacts: contacts.map(toContactDto),
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
