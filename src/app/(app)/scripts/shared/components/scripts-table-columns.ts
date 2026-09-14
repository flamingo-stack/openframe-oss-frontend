import type { TableSkeletonColumn } from '@/app/components/shared/table-column-layout';

/**
 * Column layout for the two Scripts list tables.
 *
 * Data-only on purpose (see `table-column-layout.ts`): these widths are read by
 * the live table AND its inline `<Suspense>` fallback in the same file, which
 * each used to declare their own copy. Keeping the declaration in a module with
 * no imports is what lets a renderer share it without dragging the tables' Relay
 * artifacts, mutations and cell renderers along — the reason a route-level
 * skeleton could read it too, back when there was one.
 *
 * The record is the declaration; the arrays below fix the render ORDER.
 */

const SCRIPT_COLUMNS = {
  name: { id: 'name', header: 'Name', width: 'flex-1 min-w-0' },
  shellType: { id: 'shellType', header: 'Shell Type', width: 'w-[100px] md:w-[160px]', filterable: true },
  supportedPlatforms: { id: 'supportedPlatforms', header: 'OS', width: 'w-[80px]', hideAt: 'lg', filterable: true },
  authorId: { id: 'authorId', header: 'Added by', width: 'w-[250px]', hideAt: 'lg', filterable: true },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

const SCHEDULE_COLUMNS = {
  name: { id: 'name', header: 'Script', width: 'flex-1 min-w-0' },
  supportedPlatforms: { id: 'supportedPlatforms', header: 'OS', width: 'w-[90px]', hideAt: 'lg', filterable: true },
  dateTime: {
    id: 'dateTime',
    header: 'Date & Time',
    width: 'w-[100px] md:w-[160px]',
    hideAt: 'md',
    dateFilterable: true,
  },
  repeat: { id: 'repeat', header: 'Repeat', width: 'w-[120px]', hideAt: 'md', sortable: true },
  deviceCount: { id: 'deviceCount', header: 'Devices', width: 'w-[100px] md:w-[140px]', hideAt: 'lg' },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, TableSkeletonColumn>;

export { SCHEDULE_COLUMNS, SCRIPT_COLUMNS };

/**
 * Cell widths of the top-level Scripts/Schedules switcher, shared by
 * `ScriptsTabNavigation` and the page skeleton so the bar is the same size in
 * its loading state as when it carries the real labels. Declared here, with the
 * column layouts, for the same reason: the skeleton must not import the live
 * component (and its Relay artifacts) just to learn a width.
 */
export const SCRIPTS_TAB_WIDTHS: readonly string[] = ['w-[160px]', 'w-[200px]'];

/** `/scripts` — render order for the live table and both of its skeletons. */
export const SCRIPTS_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  SCRIPT_COLUMNS.name,
  SCRIPT_COLUMNS.shellType,
  SCRIPT_COLUMNS.supportedPlatforms,
  SCRIPT_COLUMNS.authorId,
  SCRIPT_COLUMNS.actions,
  SCRIPT_COLUMNS.open,
];

/** `/scripts/schedules` — render order for the live table and both skeletons. */
export const SCHEDULES_TABLE_COLUMNS: readonly TableSkeletonColumn[] = [
  SCHEDULE_COLUMNS.name,
  SCHEDULE_COLUMNS.supportedPlatforms,
  SCHEDULE_COLUMNS.dateTime,
  SCHEDULE_COLUMNS.repeat,
  SCHEDULE_COLUMNS.deviceCount,
  SCHEDULE_COLUMNS.actions,
  SCHEDULE_COLUMNS.open,
];
