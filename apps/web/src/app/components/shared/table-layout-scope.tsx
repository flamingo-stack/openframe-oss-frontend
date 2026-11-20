'use client';

import { type DataTableSettings, LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { createContext, type ReactNode, useContext, useMemo } from 'react';
import { type TableLayout, tableLayoutFor, useTableGridGate } from '@/app/hooks/use-table-layout';

interface TableLayoutScopeValue {
  layout: TableLayout;
  /** The scope's table is its page's main content: in the grid it takes the height the page leaves under it. */
  fill: boolean;
}

/** No scope above: the card rows every table has. A table moves to the grid only where a page opts in. */
const CARDS: TableLayoutScopeValue = { layout: 'cards', fill: false };

const TableLayoutContext = createContext<TableLayoutScopeValue>(CARDS);

interface TableLayoutScopeProps {
  /**
   * The page's table is its main content (a list page): in the grid it is the page's scroll area (`maxHeight="fill"`).
   * Leave it off where the table is one section of a longer page (a details page's tab).
   */
  fill?: boolean;
  children: ReactNode;
}

/**
 * A page's answer to "cards or grid" for the tables under it. It reads the app's ONE table flag (`data-table-grid`,
 * `useTableGridGate`) once, and the tables read the answer with `useTableGrid`, however deep they sit under the page's
 * frames, boundaries and tabs.
 *
 * While the flag is read the content is in a loading scope, where every list draws its own loading form: a table never
 * draws one layout and swaps to the other.
 */
export function TableLayoutScope({ fill = false, children }: TableLayoutScopeProps) {
  const gate = useTableGridGate();
  const layout = tableLayoutFor(gate);
  // One object per answer: every table under the scope reads it.
  const value = useMemo(() => ({ layout, fill }), [layout, fill]);
  return (
    <TableLayoutContext.Provider value={value}>
      <LoadingWhen loading={gate === 'loading'}>{children}</LoadingWhen>
    </TableLayoutContext.Provider>
  );
}

/** What a table hands its `LiveTable` (or `DataTable`) to draw the layout its page asked for. */
export interface TableGridProps {
  layout: TableLayout;
  /** Grid only: `'fill'` where the page's scope says the table is its main content. */
  maxHeight: 'fill' | undefined;
  /** Grid only: the settings gear, with the viewer's column layout kept in the browser under the table's own key. */
  settings: DataTableSettings | undefined;
}

/**
 * The layout props of one table, from the scope above it. `storageKey` names the viewer's saved column layout: one key
 * per table, and per column set where a table draws different columns for different hosts.
 */
export function useTableGrid(storageKey: string): TableGridProps {
  const { layout, fill } = useContext(TableLayoutContext);
  // A stable object: the table keys the saved layout on it.
  const settings = useMemo(() => ({ storageKey }), [storageKey]);
  const grid = layout === 'grid';
  return { layout, maxHeight: grid && fill ? 'fill' : undefined, settings: grid ? settings : undefined };
}
