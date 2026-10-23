/**
 * Pins the record → form mapping (a null domain or an unknown provider still seeds Edit) and keeps a
 * stored customer selectable before its picker's list has paged to it.
 */

import { describe, expect, it, vi } from 'vitest';
import { DirectoryProvider } from '@/generated/schema-enums';

// The helpers declare the forms' record fragment beside the pure mappers under test; the tag
// would throw at module scope on import. Nothing here reads the fragment.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
}));

import { connectionToFormValues, type StoredConnectionFields, withBoundOrganization } from './tenant-form-helpers';

const ACME = { organizationId: 'org-acme', name: 'Acme' };
const GLOBEX = { organizationId: 'org-globex', name: 'Globex' };

function connection(overrides: Partial<StoredConnectionFields> = {}): StoredConnectionFields {
  return {
    provider: DirectoryProvider.GOOGLE_WORKSPACE,
    name: 'Acme Workspace',
    domain: 'acme.com',
    ...overrides,
  };
}

describe('connectionToFormValues', () => {
  it('maps the record', () => {
    expect(connectionToFormValues(connection())).toEqual({
      provider: DirectoryProvider.GOOGLE_WORKSPACE,
      domain: 'acme.com',
      name: 'Acme Workspace',
    });
  });

  it('seeds an empty domain for a connection that has none, instead of null in a string field', () => {
    expect(connectionToFormValues(connection({ domain: null })).domain).toBe('');
  });

  it('seeds a provider the form can hold when the record carries one this build does not know', () => {
    // A backend ahead of this build's SDL: a value the generated type cannot name.
    const unknownProvider = 'OKTA' as DirectoryProvider;
    expect(connectionToFormValues(connection({ provider: unknownProvider })).provider).toBe(
      DirectoryProvider.MICROSOFT_365,
    );
  });
});

describe('withBoundOrganization', () => {
  it('puts the stored customer back at the top while the list has not reached it', () => {
    expect(withBoundOrganization([GLOBEX], ACME)).toEqual([ACME, GLOBEX]);
  });

  it('does not duplicate a customer the list already has', () => {
    expect(withBoundOrganization([ACME, GLOBEX], ACME)).toEqual([ACME, GLOBEX]);
  });

  it('leaves the list alone when nothing is picked yet', () => {
    expect(withBoundOrganization([GLOBEX], null)).toEqual([GLOBEX]);
  });
});
