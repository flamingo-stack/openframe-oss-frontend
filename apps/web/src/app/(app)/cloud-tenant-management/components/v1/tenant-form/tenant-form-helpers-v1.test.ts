// Main's apps/web/src/app/(app)/cloud-tenant-management/components/tenant-form/tenant-form-helpers.test.ts, rendered while tenant-management-v2 is off. Deleted with the flag.
/**
 * Pins the record → form mapping (a null domain or an unknown provider still seeds Edit) and keeps
 * the bound customer selectable although the API lists only unbound customers.
 */

import { describe, expect, it, vi } from 'vitest';
import { DirectoryProvider } from '@/generated/schema-enums';

// The helpers declare the forms' record fragment beside the pure mappers under test; the tag
// would throw at module scope on import. Nothing here reads the fragment.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
}));

import {
  connectionToFormValuesV1,
  type StoredConnectionFieldsV1,
  withBoundOrganizationV1,
} from './tenant-form-helpers-v1';

const ACME = { organizationId: 'org-acme', name: 'Acme' };
const GLOBEX = { organizationId: 'org-globex', name: 'Globex' };

function connection(overrides: Partial<StoredConnectionFieldsV1> = {}): StoredConnectionFieldsV1 {
  return {
    provider: DirectoryProvider.GOOGLE_WORKSPACE,
    name: 'Acme Workspace',
    domain: 'acme.com',
    organizationId: ACME.organizationId,
    ...overrides,
  };
}

describe('connectionToFormValuesV1', () => {
  it('maps the record, customer by business id', () => {
    expect(connectionToFormValuesV1(connection())).toEqual({
      provider: DirectoryProvider.GOOGLE_WORKSPACE,
      domain: 'acme.com',
      name: 'Acme Workspace',
      organizationId: ACME.organizationId,
    });
  });

  it('seeds an empty domain for a connection that has none, instead of null in a string field', () => {
    expect(connectionToFormValuesV1(connection({ domain: null })).domain).toBe('');
  });

  it('seeds a provider the form can hold when the record carries one this build does not know', () => {
    // A backend ahead of this build's SDL: a value the generated type cannot name.
    const unknownProvider = 'OKTA' as DirectoryProvider;
    expect(connectionToFormValuesV1(connection({ provider: unknownProvider })).provider).toBe(
      DirectoryProvider.MICROSOFT_365,
    );
  });
});

describe('withBoundOrganizationV1', () => {
  it('puts the bound customer back at the top when the API left it out', () => {
    expect(withBoundOrganizationV1([GLOBEX], ACME)).toEqual([ACME, GLOBEX]);
  });

  it('does not duplicate a customer the list already has', () => {
    expect(withBoundOrganizationV1([ACME, GLOBEX], ACME)).toEqual([ACME, GLOBEX]);
  });

  it('leaves the list alone when nothing is bound yet (New before Generate)', () => {
    expect(withBoundOrganizationV1([GLOBEX], null)).toEqual([GLOBEX]);
  });
});
