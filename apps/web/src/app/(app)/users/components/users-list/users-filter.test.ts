import { describe, expect, it } from 'vitest';
import { toFilter, type UserSelections } from './users-filter';

const none: UserSelections = { customer: [], status: [], license: [] };

describe('toFilter', () => {
  it('is null when no funnel is ticked, so the list reads unfiltered', () => {
    expect(toFilter(none)).toBeNull();
  });

  it('sends the ticked statuses', () => {
    expect(toFilter({ ...none, status: ['SUSPENDED'] })).toEqual({ statuses: ['SUSPENDED'] });
  });

  it('drops a status this build does not know, so a stale URL cannot fail the whole query', () => {
    expect(toFilter({ ...none, status: ['SUSPENDED', 'ARCHIVED'] })).toEqual({ statuses: ['SUSPENDED'] });
    expect(toFilter({ ...none, status: ['ARCHIVED'] })).toBeNull();
  });

  it('sends the ticked customers (D33)', () => {
    expect(toFilter({ ...none, customer: ['o-1', 'o-2'] })).toEqual({ organizationIds: ['o-1', 'o-2'] });
  });

  it('splits the licence funnel into SKUs and the no-licence option', () => {
    expect(toFilter({ ...none, license: ['sku-e3', 'NO_LICENSE'] })).toEqual({ skuIds: ['sku-e3'], noLicense: true });
    expect(toFilter({ ...none, license: ['NO_LICENSE'] })).toEqual({ skuIds: [], noLicense: true });
  });
});
