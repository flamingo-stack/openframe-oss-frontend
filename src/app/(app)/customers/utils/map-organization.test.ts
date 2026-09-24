/**
 * Pins the contact list on the customer record. The edit page used to rebuild
 * the list from three named slots (primary / billing / technical) and the update
 * endpoint replaces `contactInformation` wholesale — so every contact past the
 * third was silently deleted by the next Save. Each assertion was verified to
 * fail with its guard removed.
 */

import { describe, expect, it } from 'vitest';
import { mapOrganization, type OrganizationNode } from './map-organization';

function node(overrides: Partial<OrganizationNode> = {}): OrganizationNode {
  return {
    id: 'org-1',
    organizationId: 'techflow',
    name: 'TechFlow Solutions',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

function contact(index: number) {
  return {
    contactName: `Contact ${index}`,
    title: `Title ${index}`,
    email: `contact${index}@acme.com`,
    phone: `+1-555-000${index}`,
  };
}

describe('mapOrganization contacts', () => {
  it('keeps every contact, in the order the API holds them', () => {
    const contacts = [1, 2, 3, 4, 5].map(contact);
    const mapped = mapOrganization(node({ contactInformation: { contacts } }));

    expect(mapped.contacts).toEqual(contacts);
  });

  it('maps a missing or non-list contact block to an empty list', () => {
    expect(mapOrganization(node({ contactInformation: null })).contacts).toEqual([]);
    expect(mapOrganization(node({ contactInformation: { contacts: null } })).contacts).toEqual([]);
    expect(mapOrganization(node({ contactInformation: { contacts: 'nope' as unknown as never } })).contacts).toEqual(
      [],
    );
  });

  it('turns null contact fields into empty strings so the DTO round-trips as strings', () => {
    const mapped = mapOrganization(
      node({
        contactInformation: { contacts: [{ contactName: 'Only a name', title: null, email: null, phone: null }] },
      }),
    );

    expect(mapped.contacts).toEqual([{ contactName: 'Only a name', title: '', phone: '', email: '' }]);
  });

  it('maps a missing name, industry and website to an empty string', () => {
    const mapped = mapOrganization(node({ name: null, category: null, websiteUrl: null }));

    expect(mapped.name).toBe('');
    expect(mapped.industry).toBe('');
    expect(mapped.website).toBe('');
  });
});
