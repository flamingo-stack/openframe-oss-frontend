import { describe, expect, it } from 'vitest';
import { toFilter, type UserSelections } from './users-filter';

const none: UserSelections = { tenant: [], status: [], license: [] };

describe('toFilter', () => {
  it('is null when no funnel is ticked, so the list reads unfiltered', () => {
    expect(toFilter(none)).toBeNull();
  });

  it('sends the ticked statuses', () => {
    expect(toFilter({ ...none, status: ['SUSPENDED'] })).toEqual({ statuses: ['SUSPENDED'] });
  });

  it('splits the tenant funnel into connections and the OpenFrame option', () => {
    expect(toFilter({ ...none, tenant: ['c-1', 'OPENFRAME'] })).toEqual({
      connectionIds: ['c-1'],
      includeOpenFrame: true,
    });
    expect(toFilter({ ...none, tenant: ['c-1'] })).toEqual({ connectionIds: ['c-1'], includeOpenFrame: false });
  });

  it('narrows to OpenFrame users alone with an empty connection list', () => {
    expect(toFilter({ ...none, tenant: ['OPENFRAME'] })).toEqual({ connectionIds: [], includeOpenFrame: true });
  });

  it('splits the licence funnel into SKUs and the no-licence option', () => {
    expect(toFilter({ ...none, license: ['sku-e3', 'NO_LICENSE'] })).toEqual({ skuIds: ['sku-e3'], noLicense: true });
    expect(toFilter({ ...none, license: ['NO_LICENSE'] })).toEqual({ skuIds: [], noLicense: true });
  });
});
