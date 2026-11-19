'use client';

import { OpenInNewTabCell } from '@flamingo-stack/openframe-frontend-core/components/features';
import {
  type CellContext,
  type ColumnDef,
  GRID_ACTION_COLUMN_SIZE,
  GRID_MIN_WIDTH,
  type Row,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import type { ReactNode } from 'react';
import { OpenRowButton } from '@/app/components/shared/open-row-button';
import { liveColumnMeta } from '@/app/components/shared/table-column-layout';
import { openInNewTab } from '@/lib/open-in-new-tab';
import { KNOWLEDGE_BASE_ITEM_COLUMNS } from './knowledge-base-item-columns';

/**
 * What the knowledge base lists' columns state for the grid layout, beside the card layout's widths
 * (`KNOWLEDGE_BASE_ITEM_COLUMNS`): each data column's `size` (a proposed width, to be confirmed by design) and
 * `minSize`, and the two row actions as the grid's action columns. One declaration for the four lists: a level's
 * items, the Assigned Articles tab, the archive and the assignments panel.
 */

/** NAME: an icon and text. */
export const KNOWLEDGE_BASE_NAME_GRID = { size: 480, minSize: GRID_MIN_WIDTH.icon } as const;
/** CREATED / ARCHIVED: a day with its time beside it. */
export const KNOWLEDGE_BASE_DATE_GRID = { size: 200 } as const;

/**
 * The row's ⋯ menu column. In card rows it is the menu's outlined trigger in the row's last cells; in the grid it is
 * an action column (56px, pinned right, never hidden, not in the settings menu) and the grid frames the same trigger.
 */
export function knowledgeBaseMenuColumn<T>(cell: (context: CellContext<T, unknown>) => ReactNode): ColumnDef<T> {
  return {
    id: KNOWLEDGE_BASE_ITEM_COLUMNS.actions.id,
    cell,
    enableSorting: false,
    enableHiding: false,
    size: GRID_ACTION_COLUMN_SIZE,
    meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.actions, { gridKind: 'action' }),
  };
}

/**
 * The trailing open-in-new-tab column. In card rows it is the outlined button, hidden below `md`; in the grid it is an
 * action column. Kept by hand rather than built with the lib's `actionColumn()`, which sets no `hideAt` and would show
 * the button in card rows that hide it.
 */
export function knowledgeBaseOpenColumn<T>(rowHref: (row: T) => string): ColumnDef<T> {
  return {
    id: KNOWLEDGE_BASE_ITEM_COLUMNS.open.id,
    cell: ({ row }: { row: Row<T> }) => <OpenInNewTabCell href={rowHref(row.original)} />,
    enableSorting: false,
    enableHiding: false,
    size: GRID_ACTION_COLUMN_SIZE,
    meta: liveColumnMeta(KNOWLEDGE_BASE_ITEM_COLUMNS.open, {
      gridKind: 'action',
      gridCell: ({ row }: { row: Row<T> }) => (
        <OpenRowButton grid label="Open in new tab" onClick={openInNewTab(rowHref(row.original))} />
      ),
    }),
  };
}
