import { describe, expect, it } from 'vitest';
import { toFilter } from './users-filter';

describe('toFilter', () => {
  it('is null when no funnel is ticked, so the list reads unfiltered', () => {
    expect(toFilter({ tenant: [], status: [] })).toBeNull();
  });

  it('sends the ticked statuses', () => {
    expect(toFilter({ tenant: [], status: ['SUSPENDED'] })).toEqual({ statuses: ['SUSPENDED'] });
  });

  it('splits the tenant funnel into connections and the OpenFrame option', () => {
    expect(toFilter({ tenant: ['c-1', 'OPENFRAME'], status: [] })).toEqual({
      connectionIds: ['c-1'],
      includeOpenFrame: true,
    });
    expect(toFilter({ tenant: ['c-1'], status: [] })).toEqual({ connectionIds: ['c-1'], includeOpenFrame: false });
  });

  it('narrows to OpenFrame users alone with an empty connection list', () => {
    expect(toFilter({ tenant: ['OPENFRAME'], status: [] })).toEqual({ connectionIds: [], includeOpenFrame: true });
  });
});
