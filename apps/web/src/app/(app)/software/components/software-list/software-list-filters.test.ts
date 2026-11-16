import { describe, expect, it } from 'vitest';
import { SOFTWARE_LIST_FILTER_OPTIONS, toSoftwareFilter } from './software-list-filters';

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

describe('SOFTWARE_LIST_FILTER_OPTIONS', () => {
  it('offers no auto-update state without a word for it (adoption has no Adopt yet)', () => {
    expect(SOFTWARE_LIST_FILTER_OPTIONS.autoUpdate.map(option => option.value)).toEqual(['ON', 'OFF', 'NO_PACKAGE']);
  });
});
