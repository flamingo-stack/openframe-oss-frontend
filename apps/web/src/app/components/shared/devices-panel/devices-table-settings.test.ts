/**
 * What a devices panel's table takes for its layout. The loaded panel and its loading form both read it from here, so
 * the table the rows arrive in is the table already drawn: same height, same saved column layout.
 */
import { describe, expect, it } from 'vitest';
import {
  ASSIGNED_DEVICES_TABLE_SETTINGS,
  CUSTOMER_DEVICES_TABLE_SETTINGS,
  DEVICES_ARCHIVE_TABLE_SETTINGS,
  DEVICES_TABLE_SETTINGS,
  devicesTableGridProps,
} from './devices-table-settings';

describe('devicesTableGridProps', () => {
  it('gives the card rows neither a height nor settings, whatever else is passed', () => {
    const none = { tableMaxHeight: undefined, tableSettings: undefined };
    expect(devicesTableGridProps({})).toEqual(none);
    expect(devicesTableGridProps({ tableLayout: 'cards' })).toEqual(none);
    expect(devicesTableGridProps({ tableLayout: 'cards', tableSettings: DEVICES_ARCHIVE_TABLE_SETTINGS })).toEqual(
      none,
    );
  });

  it("makes the grid table the page's scroll area where the panel is the page, under the Devices page's key", () => {
    expect(devicesTableGridProps({ tableLayout: 'grid' })).toEqual({
      tableMaxHeight: 'fill',
      tableSettings: DEVICES_TABLE_SETTINGS,
    });
  });

  it('keeps the grid table at its natural height when the panel is embedded in a longer page', () => {
    expect(devicesTableGridProps({ tableLayout: 'grid', embedded: true }).tableMaxHeight).toBeUndefined();
  });

  it("keeps the column layout under the host's own key when it passes one", () => {
    expect(
      devicesTableGridProps({ tableLayout: 'grid', embedded: true, tableSettings: CUSTOMER_DEVICES_TABLE_SETTINGS }),
    ).toEqual({ tableMaxHeight: undefined, tableSettings: CUSTOMER_DEVICES_TABLE_SETTINGS });
    expect(devicesTableGridProps({ tableLayout: 'grid', tableSettings: DEVICES_ARCHIVE_TABLE_SETTINGS })).toEqual({
      tableMaxHeight: 'fill',
      tableSettings: DEVICES_ARCHIVE_TABLE_SETTINGS,
    });
  });

  it('gives every devices table a key of its own: two tables with one key would share a saved layout', () => {
    const keys = [
      DEVICES_TABLE_SETTINGS,
      DEVICES_ARCHIVE_TABLE_SETTINGS,
      CUSTOMER_DEVICES_TABLE_SETTINGS,
      ASSIGNED_DEVICES_TABLE_SETTINGS,
    ].map(settings => settings.storageKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
