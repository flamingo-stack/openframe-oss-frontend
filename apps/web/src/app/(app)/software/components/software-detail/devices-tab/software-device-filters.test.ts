import { describe, expect, it } from 'vitest';
import { softwareDeviceFilterOptions, toSoftwareOnDeviceFilter } from './software-device-filters';

describe('toSoftwareOnDeviceFilter', () => {
  it('is null with nothing ticked and no tags, so the query reads unfiltered', () => {
    expect(toSoftwareOnDeviceFilter({}, [])).toBeNull();
    expect(toSoftwareOnDeviceFilter({ softwareVersion: [], installedBy: [], autoUpdate: [] }, [])).toBeNull();
  });

  it('sends each funnel and the tags as the fields the backend filters on, and only the ticked ones', () => {
    expect(
      toSoftwareOnDeviceFilter({ softwareVersion: ['OUTDATED'], installedBy: [], autoUpdate: ['OFF'] }, ['tag-1']),
    ).toEqual({ statuses: ['OUTDATED'], autoUpdateStatuses: ['OFF'], deviceTagIds: ['tag-1'] });
    expect(toSoftwareOnDeviceFilter({ installedBy: ['BREW'] }, [])).toEqual({ installedBy: ['BREW'] });
  });
});

describe('softwareDeviceFilterOptions', () => {
  // What test-env.qa answered for gh on 2026-11-17, on the read model.
  const answered = {
    statuses: [
      { value: 'UP_TO_DATE', label: 'Up to date', count: 0 },
      { value: 'OUTDATED', label: 'Outdated', count: 9 },
    ],
    installedBy: [{ value: 'BREW', label: 'Brew', count: 9 }],
    autoUpdateStatuses: [
      { value: 'OFF', label: 'Off', count: 9 },
      { value: 'NEEDS_ADOPTION', label: 'Needs adoption', count: 2 },
    ],
  };

  it('offers what occurs on the devices, worded as the cells word it, with counts', () => {
    const options = softwareDeviceFilterOptions(answered);
    expect(options.softwareVersion.map(({ value, label, count }) => ({ value, label, count }))).toEqual([
      { value: 'OUTDATED', label: 'Outdated', count: 9 },
    ]);
    expect(options.installedBy.map(({ value, label }) => ({ value, label }))).toEqual([
      { value: 'BREW', label: 'Brew' },
    ]);
    // NEEDS_ADOPTION is drawn as the empty mark until there is an Adopt, so it is not offered.
    expect(options.autoUpdate.map(({ value }) => value)).toEqual(['OFF']);
  });

  it('offers nothing where the backend leaves the facets empty (Fleet paging)', () => {
    expect(softwareDeviceFilterOptions({ statuses: [], installedBy: [], autoUpdateStatuses: [] })).toEqual({
      softwareVersion: [],
      installedBy: [],
      autoUpdate: [],
    });
  });
});
