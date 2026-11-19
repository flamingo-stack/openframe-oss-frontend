import type { DataTableSettings } from '@flamingo-stack/openframe-frontend-core/components/ui';

/**
 * The incidents grid table's settings: the gear's menu of columns, with the viewer's layout (hidden columns, their
 * order, resized widths) kept in the browser. A key per place the table is drawn: a device's incidents have no Device
 * column and their own width to fit. The Incidents page's tabs share one: they draw the same columns.
 */
const INCIDENTS_TABLE_SETTINGS = {
  page: { storageKey: 'incidents' },
  device: { storageKey: 'device-incidents' },
} satisfies Record<string, DataTableSettings>;

/** Where an incidents table is drawn: the Incidents page, a device's Incidents tab. */
export type IncidentsTablePlace = keyof typeof INCIDENTS_TABLE_SETTINGS;

export function incidentsTableSettings(place: IncidentsTablePlace): DataTableSettings {
  return INCIDENTS_TABLE_SETTINGS[place];
}
