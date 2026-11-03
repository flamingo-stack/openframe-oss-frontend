import { describe, expect, it } from 'vitest';
import { DirectoryConnectionSortField, SortDirection } from '@/generated/schema-enums';
import { toTenantFilter, toTenantOrderBy } from './tenants-filter';

const NONE = { tenant: [], customer: [], licenses: [], access: [] };

describe('toTenantFilter', () => {
  it('is null with nothing ticked', () => {
    expect(toTenantFilter(NONE)).toBeNull();
  });

  it('sends only the funnels that are ticked, under the names the query takes', () => {
    expect(toTenantFilter({ ...NONE, tenant: ['MICROSOFT_365'], customer: ['o-1'] })).toEqual({
      providers: ['MICROSOFT_365'],
      organizationIds: ['o-1'],
    });
    expect(toTenantFilter({ ...NONE, licenses: ['HAS_UNUSED_SEATS'], access: ['DISCONNECTED'] })).toEqual({
      licenses: ['HAS_UNUSED_SEATS'],
      accessStates: ['DISCONNECTED'],
    });
  });

  it('drops a value this build does not know, so a stale URL cannot fail the whole query', () => {
    expect(
      toTenantFilter({
        ...NONE,
        tenant: ['MICROSOFT_365', 'ZOHO'],
        licenses: ['HAS_UNUSED_SEATS', 'GONE'],
        access: ['DISCONNECTED', 'PAUSED'],
      }),
    ).toEqual({ providers: ['MICROSOFT_365'], licenses: ['HAS_UNUSED_SEATS'], accessStates: ['DISCONNECTED'] });
    expect(toTenantFilter({ tenant: ['ZOHO'], customer: [], licenses: ['GONE'], access: ['PAUSED'] })).toBeNull();
  });
});

describe('toTenantOrderBy', () => {
  it('sorts by what the list offers', () => {
    expect(toTenantOrderBy(DirectoryConnectionSortField.USERS, 'desc')).toEqual({
      field: DirectoryConnectionSortField.USERS,
      direction: SortDirection.DESC,
    });
    expect(toTenantOrderBy(DirectoryConnectionSortField.LAST_READ, 'asc')?.direction).toBe(SortDirection.ASC);
  });

  it('leaves anything else to the server, a hand-edited URL or a field the brief rules out', () => {
    expect(toTenantOrderBy('', '')).toBeNull();
    expect(toTenantOrderBy(DirectoryConnectionSortField.LICENSES_UNUSED, 'desc')).toBeNull();
  });
});
