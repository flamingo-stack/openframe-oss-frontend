import type { ContactPersonDto, CreateCustomerRequest } from '../hooks/use-create-customer';
import { type CustomerFormData, EMPTY_CONTACT_ROW } from '../types/customer-form.types';
import type { CustomerDetails } from './map-organization';

/**
 * Fields the form does not edit but the write endpoint expects on every call —
 * category, employees, revenue, contract dates. They are read from the live
 * record at submit time and sent back as they are.
 */
export interface PreservedCustomerFields {
  category?: string;
  numberOfEmployees: number | null;
  monthlyRevenue: number | null;
  contractStartDate?: string;
  contractEndDate?: string;
}

export const DEFAULT_PRESERVED_FIELDS: PreservedCustomerFields = {
  numberOfEmployees: null,
  monthlyRevenue: null,
};

/** `mapOrganization` renders a missing value as '-'; the form wants ''. */
export const stripPlaceholder = (value?: string | null): string => (!value || value === '-' ? '' : value);

const toDateOnly = (value: string | null): string | undefined =>
  value ? new Date(value).toISOString().slice(0, 10) : undefined;

export function toPreservedFields(organization: CustomerDetails): PreservedCustomerFields {
  return {
    category: stripPlaceholder(organization.industry) || undefined,
    numberOfEmployees: organization.employees,
    monthlyRevenue: organization.mrrUsd,
    contractStartDate: toDateOnly(organization.contractStart),
    contractEndDate: toDateOnly(organization.contractEnd),
  };
}

export const isBlankContact = (contact: ContactPersonDto): boolean =>
  !contact.contactName && !contact.title && !contact.phone && !contact.email;

/**
 * The record as the form shows it. The checkbox is inferred from the two
 * addresses (the flag the API holds is not mapped), and whenever it is on the
 * mailing line mirrors the physical one — the disabled Mailing input displays
 * the physical address, as it always has. A record without contacts seeds one
 * empty row, like a new customer, so the inputs are there to type into.
 */
export function recordToForm(organization: CustomerDetails): CustomerFormData {
  const physical = organization.physicalAddress || '';
  const mailing = organization.mailingAddress || '';
  const mailingSameAsPhysical = !mailing || mailing === physical;
  const contacts = organization.contacts.filter(contact => !isBlankContact(contact));

  return {
    name: stripPlaceholder(organization.name),
    website: stripPlaceholder(organization.website),
    notes: (organization.notes || []).join('\n'),
    physicalAddress: physical,
    mailingAddress: mailingSameAsPhysical ? physical : mailing,
    mailingSameAsPhysical,
    contacts: contacts.length > 0 ? contacts : [EMPTY_CONTACT_ROW],
  };
}

const buildAddressDto = (raw: string) => ({
  street1: raw || '',
  street2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
});

/**
 * The write payload. `name` / `website` arrive trimmed from the schema; notes
 * and the address lines pass through as typed. Optional text fields are
 * omitted when blank (the endpoint treats a missing field as "unchanged").
 */
export function formToWriteInput(data: CustomerFormData, preserved: PreservedCustomerFields): CreateCustomerRequest {
  const physical = data.physicalAddress;
  const mailing = data.mailingSameAsPhysical ? physical : data.mailingAddress;

  return {
    name: data.name.trim(),
    category: preserved.category,
    numberOfEmployees: preserved.numberOfEmployees,
    websiteUrl: data.website.trim() || undefined,
    notes: data.notes || undefined,
    contactInformation: {
      contacts: data.contacts.filter(contact => !isBlankContact(contact)),
      physicalAddress: buildAddressDto(physical),
      mailingAddress: buildAddressDto(mailing),
      mailingAddressSameAsPhysical: data.mailingSameAsPhysical,
    },
    monthlyRevenue: preserved.monthlyRevenue,
    contractStartDate: preserved.contractStartDate,
    contractEndDate: preserved.contractEndDate,
  };
}
