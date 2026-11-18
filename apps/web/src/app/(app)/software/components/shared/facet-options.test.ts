import { describe, expect, it } from 'vitest';
import { facetOptions, facetScope, filterWindowGroups, filterWindowSelections } from './facet-options';

describe('facetScope', () => {
  it("leaves the funnel's own field out, so it counts over the other funnels only", () => {
    expect(facetScope({ osTypes: ['WINDOWS'], sources: ['BREW'] }, 'sources')).toEqual({ osTypes: ['WINDOWS'] });
  });

  it('is null when nothing else is ticked, as the queries take "unfiltered"', () => {
    expect(facetScope({ sources: ['BREW'] }, 'sources')).toBeNull();
    expect(facetScope({ sources: ['BREW'], osTypes: [] }, 'sources')).toBeNull();
    expect(facetScope<{ sources?: string[] }>(null, 'sources')).toBeNull();
  });
});

describe('facetOptions', () => {
  const facet = [
    { value: 'BREW', label: 'Brew', count: 0 },
    { value: 'WINGET', label: 'Winget', count: 3 },
  ];

  it('drops a value nothing has, unless it is ticked', () => {
    expect(facetOptions(facet, () => undefined).map(option => option.value)).toEqual(['WINGET']);
    expect(facetOptions(facet, () => undefined, ['BREW']).map(option => option.value)).toEqual(['BREW', 'WINGET']);
  });
});

describe('filter window', () => {
  it('turns the funnels into groups and reads its answer back per funnel', () => {
    const groups = filterWindowGroups([
      [{ id: 'engine', header: 'Engine' }, facetOptions([{ value: 'BREW', label: 'Brew', count: 2 }], () => undefined)],
    ]);
    expect(groups).toEqual([{ id: 'engine', title: 'Engine', options: [{ id: 'BREW', label: 'Brew', count: 2 }] }]);
    expect(filterWindowSelections(['engine', 'os'], { engine: ['BREW'] })).toEqual({ engine: ['BREW'], os: [] });
  });
});
