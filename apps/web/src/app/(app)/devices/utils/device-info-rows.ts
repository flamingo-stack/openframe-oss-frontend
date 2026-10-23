import { EMPTY_VALUE, isEmptyValue } from '@/lib/empty-value';

/** One labelled row of a device detail card (the Hardware, OS and Network tabs), with its raw value. */
export type DeviceInfoRow = { label: string; value?: string | number | null; copyable?: boolean };

const hasValue = (row: DeviceInfoRow) => !isEmptyValue(row.value) && String(row.value).trim() !== '';

/**
 * The rows a device detail card draws, the same rows its loading form draws (`labelsOf(rows)`): every row is a field
 * most devices report, so a device without it shows the empty mark rather than a shorter card. A field only some
 * devices report is left out of the row list altogether, from both forms.
 */
export function deviceInfoItems(rows: DeviceInfoRow[]): Array<{ label: string; value: string; copyable?: boolean }> {
  return rows.map(row =>
    hasValue(row)
      ? { label: row.label, value: String(row.value), copyable: row.copyable }
      : { label: row.label, value: EMPTY_VALUE },
  );
}

/** Whether the device reports any of the rows (a section with none is not drawn once the device answers). */
export function hasDeviceInfo(rows: DeviceInfoRow[]): boolean {
  return rows.some(hasValue);
}
