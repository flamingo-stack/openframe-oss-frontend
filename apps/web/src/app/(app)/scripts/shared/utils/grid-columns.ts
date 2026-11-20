import {
  type ScriptsTableColumnLayout,
  scriptsColumnSize,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import type { DataTableSettings } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';

/**
 * What the Scripts tables' columns state for the grid layout, read from the same column layout the card rows use
 * (the core library's `SCRIPT_COLUMNS` / `SCHEDULE_COLUMNS` / `EXECUTION_COLUMNS`, or a table's own of that shape):
 * the column's width, its name in the settings menu, and whether it is a row action pinned right. The card rows read
 * none of it.
 */

/** A live column's grid width: `size` and, where the layout states one, `minSize`. Spread into the column definition. */
export const scriptsLiveColumnSize = scriptsColumnSize;

/**
 * `meta` for a live column of a Scripts table: the shared layout (`liveColumnMeta`) plus the grid's `label` and
 * `gridKind` from the same layout, and the column's own extras (`filter`, `gridCell`, …).
 */
export function scriptsLiveColumnMeta<const T extends object>(column: ScriptsTableColumnLayout, extra?: T) {
  const grid = { label: column.label, gridKind: column.gridKind };
  return liveColumnMeta(column, { ...grid, ...(extra as T) });
}

/**
 * The grid table's settings of each Scripts table: the viewer's column layout (hidden columns, their order, resized
 * widths), kept in the browser under the table's own key. Tables that draw the same columns share a key.
 */
export const SCRIPTS_TABLE_SETTINGS = {
  /** The scripts list and its archive: the same columns. */
  scripts: { storageKey: 'scripts' },
  /** The schedules list and its archive. */
  schedules: { storageKey: 'script-schedules' },
  /** A schedule's runs. */
  scheduleRuns: { storageKey: 'schedule-runs' },
  /** A script's Execution History. */
  scriptExecutions: { storageKey: 'script-executions' },
  /** A schedule's Execution History and a run's executions: one table, the same columns. */
  scheduleExecutions: { storageKey: 'schedule-executions' },
} satisfies Record<string, DataTableSettings>;
