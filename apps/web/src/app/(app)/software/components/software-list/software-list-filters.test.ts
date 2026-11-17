import { describe, expect, it } from 'vitest';
import { softwareListFilterOptions, toSoftwareFilter } from './software-list-filters';

describe('toSoftwareFilter', () => {
  it('is null with nothing ticked, so the query reads unfiltered', () => {
    expect(toSoftwareFilter({})).toBeNull();
    expect(toSoftwareFilter({ os: [], engine: [], autoUpdate: [] })).toBeNull();
  });

  it('sends each funnel as the field the backend filters on, and only the ticked ones', () => {
    expect(toSoftwareFilter({ os: ['MAC_OS'], engine: [], autoUpdate: ['ON', 'OFF'] })).toEqual({
      osTypes: ['MAC_OS'],
      autoUpdateStatuses: ['ON', 'OFF'],
    });
    expect(toSoftwareFilter({ engine: ['BREW'] })).toEqual({ sources: ['BREW'] });
  });
});

describe('softwareListFilterOptions', () => {
  // What test-env.qa answered on 2026-11-17, on the read model.
  const answered = {
    sources: [
      { value: 'WINGET', label: 'Winget', count: 6 },
      { value: 'BREW', label: 'Brew', count: 113 },
      { value: 'UNMANAGED', label: 'Unmanaged', count: 687 },
    ],
    autoUpdateStatuses: [
      { value: 'OFF', label: 'Off', count: 114 },
      { value: 'NO_PACKAGE', label: 'No package', count: 62 },
      { value: 'NEEDS_ADOPTION', label: 'Needs adoption', count: 3 },
    ],
  };

  it('offers what occurs, worded as the cells word it, with counts', () => {
    const options = softwareListFilterOptions(answered);
    expect(options.engine.map(({ value, label, count }) => ({ value, label, count }))).toEqual([
      { value: 'WINGET', label: 'WinGet', count: 6 },
      { value: 'BREW', label: 'Brew', count: 113 },
    ]);
    expect(options.autoUpdate.map(({ value, label }) => ({ value, label }))).toEqual([
      { value: 'OFF', label: 'Off' },
      { value: 'NO_PACKAGE', label: 'No package found' },
    ]);
    expect(options.os.length).toBeGreaterThan(0);
  });

  it('takes the server word for a value this build does not know', () => {
    const options = softwareListFilterOptions({
      sources: [{ value: 'SNAP', label: 'Snap', count: 2 }],
      autoUpdateStatuses: [],
    });
    expect(options.engine).toEqual([{ id: 'SNAP', value: 'SNAP', label: 'Snap', count: 2 }]);
  });

  it('offers no funnel where the backend has no facets (Fleet paging ignores them)', () => {
    expect(softwareListFilterOptions({ sources: [], autoUpdateStatuses: [] })).toEqual({
      os: [],
      engine: [],
      autoUpdate: [],
    });
  });
});
