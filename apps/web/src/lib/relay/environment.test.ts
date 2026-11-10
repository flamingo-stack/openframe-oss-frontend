/**
 * The store's normalization: a type whose `id` is a value shared across records (`UNNORMALIZED_TYPES`) must not merge
 * two parents' entries into one record.
 */

import { createOperationDescriptor } from 'relay-runtime';
import { afterEach, describe, expect, it } from 'vitest';
import tenantLicensesSectionQuery, {
  type tenantLicensesSectionQuery$data,
} from '@/__generated__/tenantLicensesSectionQuery.graphql';
import { getRelayEnvironment, resetRelayEnvironment } from './environment';

describe('getRelayEnvironment normalization', () => {
  afterEach(() => resetRelayEnvironment());

  it("keeps two tenants' licence rows apart though the provider gives both the same SKU id", () => {
    const environment = getRelayEnvironment();
    const readLicences = (connectionId: string, assigned: number) => {
      const operation = createOperationDescriptor(tenantLicensesSectionQuery, {
        id: connectionId,
        search: null,
        orderBy: null,
      });
      environment.retain(operation);
      environment.commitPayload(operation, {
        directoryConnection: {
          id: connectionId,
          licenseSummary: { assigned },
          licenses: [
            { id: 'sku-e3', name: 'Office 365 E3', assigned, purchased: 10, unused: 10 - assigned, free: false },
          ],
        },
      });
      return operation;
    };
    const tenantA = readLicences('c-a', 3);
    readLicences('c-b', 7);

    const { directoryConnection } = environment.lookup(tenantA.fragment).data as tenantLicensesSectionQuery$data;
    expect(directoryConnection?.licenses.map(license => license.assigned)).toEqual([3]);
  });
});
