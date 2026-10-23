import type { InfoCardData } from '@flamingo-stack/openframe-frontend-core';

/**
 * What an `InfoCard` is handed while its record is read: no rows. In a loading scope the card then draws the
 * `skeleton` shape its caller states (the device tabs, the log details' Full Information card).
 */
export const EMPTY_CARD: InfoCardData = { items: [] };

/** A card's row labels, drawn real in its skeleton while the record is read (only the values are bars). */
export const labelsOf = (rows: ReadonlyArray<{ label: string }>) => rows.map(row => row.label);
