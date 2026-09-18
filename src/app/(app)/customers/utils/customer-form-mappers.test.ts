/**
 * Pins the record ↔ form ↔ payload contract the customer form was migrated
 * onto: placeholders stripped, the mailing line mirrored on seed, the exact
 * create payload for blank optional fields, and a contact list that survives
 * the round trip whole and in order. Each assertion was verified to fail with
 * its guard removed.
 */

import { describe, expect, it } from 'vitest';
import { CUSTOMER_FORM_DEFAULT_VALUES } from '../types/customer-form.types';
import {
  DEFAULT_PRESERVED_FIELDS,
  formToWriteInput,
  recordToForm,
  stripPlaceholder,
  toPreservedFields,
} from './customer-form-mappers';
import type { CustomerDetails } from './map-organization';

function customer(overrides: Partial<CustomerDetails> = {}): CustomerDetails {
  return {
    id: 'org-1',
    organizationId: 'techflow',
    name: 'TechFlow Solutions',
    industry: '-',
    website: '-',
    employees: null,
    updatedAt: '2026-01-02T00:00:00Z',
    physicalAddress: '',
    mailingAddress: '',
    contacts: [],
    mrrUsd: null,
    contractStart: null,
    contractEnd: null,
    notes: [],
    isDefault: false,
    status: 'ACTIVE',
    ...overrides,
  };
}

const contact = (index: number) => ({
  contactName: `Contact ${index}`,
  title: `Title ${index}`,
  phone: `+1-555-000${index}`,
  email: `contact${index}@acme.com`,
});

describe('recordToForm', () => {
  it('strips the "-" placeholders and joins the notes', () => {
    const form = recordToForm(customer({ notes: ['line one\nline two'] }));

    expect(form.name).toBe('TechFlow Solutions');
    expect(form.website).toBe('');
    expect(form.notes).toBe('line one\nline two');
    expect(stripPlaceholder('-')).toBe('');
    expect(stripPlaceholder(null)).toBe('');
  });

  it('infers "same as physical" from an empty mailing line and mirrors the physical address into it', () => {
    const form = recordToForm(customer({ physicalAddress: '1 Main St', mailingAddress: '' }));

    expect(form.mailingSameAsPhysical).toBe(true);
    expect(form.mailingAddress).toBe('1 Main St');
  });

  it('keeps a distinct mailing address with the checkbox off', () => {
    const form = recordToForm(customer({ physicalAddress: '1 Main St', mailingAddress: 'PO Box 9' }));

    expect(form.mailingSameAsPhysical).toBe(false);
    expect(form.mailingAddress).toBe('PO Box 9');
  });

  it('carries every contact in order and drops rows with nothing in them', () => {
    const blank = { contactName: '', title: '', phone: '', email: '' };
    const form = recordToForm(customer({ contacts: [contact(1), blank, contact(2), contact(3), contact(4)] }));

    expect(form.contacts).toEqual([contact(1), contact(2), contact(3), contact(4)]);
  });
});

describe('formToWriteInput', () => {
  it('builds the exact create payload for a form with only a name', () => {
    const payload = formToWriteInput({ ...CUSTOMER_FORM_DEFAULT_VALUES, name: '  Acme  ' }, DEFAULT_PRESERVED_FIELDS);

    expect(payload).toEqual({
      name: 'Acme',
      category: undefined,
      numberOfEmployees: null,
      websiteUrl: undefined,
      notes: undefined,
      contactInformation: {
        contacts: [],
        physicalAddress: { street1: '', street2: '', city: '', state: '', postalCode: '', country: '' },
        mailingAddress: { street1: '', street2: '', city: '', state: '', postalCode: '', country: '' },
        mailingAddressSameAsPhysical: true,
      },
      monthlyRevenue: null,
      contractStartDate: undefined,
      contractEndDate: undefined,
    });
  });

  it('writes the physical address as the mailing address while the checkbox is on, untrimmed', () => {
    const payload = formToWriteInput(
      {
        ...CUSTOMER_FORM_DEFAULT_VALUES,
        name: 'Acme',
        physicalAddress: ' 1 Main St ',
        mailingAddress: 'stale',
        notes: '  keep  ',
      },
      DEFAULT_PRESERVED_FIELDS,
    );

    expect(payload.contactInformation.mailingAddress.street1).toBe(' 1 Main St ');
    expect(payload.contactInformation.physicalAddress.street1).toBe(' 1 Main St ');
    expect(payload.notes).toBe('  keep  ');
  });

  it('round-trips the contact list whole and in order, blank rows removed', () => {
    const record = customer({ contacts: [1, 2, 3, 4, 5].map(contact) });
    const form = recordToForm(record);
    form.contacts.splice(0, 1);
    form.contacts.push({ contactName: '', title: '', phone: '', email: '' });

    const payload = formToWriteInput(form, toPreservedFields(record));

    expect(payload.contactInformation.contacts).toEqual([2, 3, 4, 5].map(contact));
    expect(Array.isArray(payload.contactInformation.contacts)).toBe(true);
  });
});

describe('toPreservedFields', () => {
  it('reads the API-only fields off the record and keeps the dates as yyyy-mm-dd', () => {
    const preserved = toPreservedFields(
      customer({
        industry: 'Healthcare',
        employees: 120,
        mrrUsd: 4500,
        contractStart: '2026-01-01T00:00:00Z',
        contractEnd: '2026-12-31T00:00:00Z',
      }),
    );

    expect(preserved).toEqual({
      category: 'Healthcare',
      numberOfEmployees: 120,
      monthlyRevenue: 4500,
      contractStartDate: '2026-01-01',
      contractEndDate: '2026-12-31',
    });
    expect(toPreservedFields(customer()).category).toBeUndefined();
  });
});
