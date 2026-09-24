/**
 * Pins the record → form mapping (a null domain or an unknown provider still seeds Edit) and keeps
 * the bound customer selectable although the API lists only unbound customers.
 */

import { describe, expect, it } from 'vitest';
import { DirectoryProvider, DirectorySyncStatus } from '@/generated/schema-enums';
import type { TenantConnectionRecord, TenantOrganization } from '../types/tenant-connection';
import { connectionToFormValues, withBoundOrganization } from './tenant-form-helpers';

const ACME: TenantOrganization = { id: 'org-acme', name: 'Acme' };
const GLOBEX: TenantOrganization = { id: 'org-globex', name: 'Globex' };

function connection(overrides: Partial<TenantConnectionRecord> = {}): TenantConnectionRecord {
  return {
    id: 'c-1',
    provider: DirectoryProvider.GOOGLE_WORKSPACE,
    name: 'Acme Workspace',
    domain: 'acme.com',
    enabled: true,
    directoryId: null,
    grantedBy: null,
    connectedAt: null,
    lastSyncStatus: DirectorySyncStatus.NEVER,
    lastSyncAt: null,
    lastSyncError: null,
    organizationId: ACME.id,
    organization: ACME,
    userCount: null,
    consentUrl: null,
    ...overrides,
  };
}

describe('connectionToFormValues', () => {
  it('maps the record, customer by business id', () => {
    expect(connectionToFormValues(connection())).toEqual({
      provider: DirectoryProvider.GOOGLE_WORKSPACE,
      domain: 'acme.com',
      name: 'Acme Workspace',
      organizationId: ACME.id,
    });
  });

  it('seeds an empty domain for a connection that has none, instead of null in a string field', () => {
    expect(connectionToFormValues(connection({ domain: null })).domain).toBe('');
  });

  it('seeds a provider the form can hold when the record carries one this build does not know', () => {
    expect(connectionToFormValues(connection({ provider: 'OKTA' })).provider).toBe(DirectoryProvider.MICROSOFT_365);
  });
});

describe('withBoundOrganization', () => {
  it('puts the bound customer back at the top when the API left it out', () => {
    expect(withBoundOrganization([GLOBEX], ACME)).toEqual([ACME, GLOBEX]);
  });

  it('does not duplicate a customer the list already has', () => {
    expect(withBoundOrganization([ACME, GLOBEX], ACME)).toEqual([ACME, GLOBEX]);
  });

  it('leaves the list alone when nothing is bound yet (New before Generate)', () => {
    expect(withBoundOrganization([GLOBEX], null)).toEqual([GLOBEX]);
  });
});
