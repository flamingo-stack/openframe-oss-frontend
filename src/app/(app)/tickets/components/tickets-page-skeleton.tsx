'use client';

import { Board } from '@flamingo-stack/openframe-frontend-core';
import {
  BoxArchiveIcon,
  Filter02Icon,
  PenEditIcon,
  PlusCircleIcon,
  TableCellIcon,
  TableColIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  type ActionsMenuGroup,
  Autocomplete,
  Button,
  type PageActionButton,
  PageLayout,
  TabSelector,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { TableSkeleton, type TableSkeletonColumn, TagFilterBarSkeleton } from '@/app/components/shared';
import { useIsMobileViewport } from '@/app/hooks/use-is-mobile-viewport';
import { resolveTicketsViewMode } from '../utils/resolve-view-mode';
import { usePlaceholderBoardColumns } from './board-columns-cache';
import { ticketTableColumns } from './ticket-table-layout';

/**
 * Route-level skeleton for `/tickets`, mirroring `TicketsView`'s two modes.
 *
 * Structure is copied 1:1 from `TicketsBoard` / `TicketsTable` — the same
 * `PageLayout` props (including the view `selector` and the "…" menu, which
 * both change the header's width), the same toolbar wrappers, and the same
 * board container. Anything with a real, non-fetching component behind it uses
 * that component: the `Board` itself with `isLoading` columns, the header
 * `TabSelector`, and the two filter `Autocomplete`s with an empty option list.
 */

const noop = () => {};

const ACTIONS: PageActionButton[] = [
  {
    label: 'New Ticket',
    variant: 'outline',
    disabled: true,
    icon: <PlusCircleIcon className="w-5 h-5 text-ods-text-secondary" />,
  },
];

/**
 * The two entries `useTicketsActions` always adds. ("Archive Resolved Tickets"
 * is appended only when the resolved count is known to be > 0, so it can't be
 * part of the loading state.)
 */
const MENU_ACTIONS: ActionsMenuGroup[] = [
  {
    items: [
      {
        id: 'edit-statuses',
        label: 'Edit Statuses',
        icon: <PenEditIcon className="text-ods-text-secondary" />,
        disabled: true,
      },
      {
        id: 'tickets-archive',
        label: 'Tickets Archive',
        icon: <BoxArchiveIcon className="text-ods-text-secondary" />,
        disabled: true,
      },
    ],
  },
];

// Mirrors the column meta in `ticket-table-columns.tsx`.
// Same declaration `getTicketTableColumns` renders from — see `ticket-table-layout`.
const COLUMNS: readonly TableSkeletonColumn[] = ticketTableColumns();

const EMPTY_OPTIONS: never[] = [];
const EMPTY_VALUE: never[] = [];

const mobileFilterButton = (
  <Button
    variant="outline"
    size="icon"
    className="md:hidden"
    onClick={noop}
    aria-label="Open filters"
    leftIcon={<Filter02Icon className="text-ods-text-primary" />}
  />
);

export function TicketsPageSkeleton({ viewMode }: { viewMode?: string }) {
  // Same resolver the live view runs, so the skeleton can't draw the mode that
  // is about to be replaced: an absent (or empty) `?viewMode=` is the board on
  // md and up and the table below it, a stray `?viewMode=grid` is the table on
  // both sides.
  const isMobileViewport = useIsMobileViewport();
  const isTable = resolveTicketsViewMode(viewMode, isMobileViewport) === 'table';
  // Read once, on mount: the lane set must not shift while the skeleton is up.
  const boardColumns = usePlaceholderBoardColumns();

  const selector = (
    <TabSelector
      value={isTable ? 'table' : 'board'}
      onValueChange={noop}
      items={[
        { id: 'table', icon: <TableCellIcon className="w-6 h-6" /> },
        { id: 'board', icon: <TableColIcon className="w-6 h-6" /> },
      ]}
    />
  );

  return (
    <PageLayout
      title="Tickets"
      actions={ACTIONS}
      menuActions={MENU_ACTIONS}
      actionsVariant="menu-primary"
      selector={selector}
      className="h-full px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      contentClassName="flex flex-col min-h-0"
    >
      {isTable ? (
        <div className="sticky top-0 z-20 flex flex-col gap-[var(--spacing-system-xxs)] bg-ods-bg -mx-[var(--spacing-system-l)] px-[var(--spacing-system-l)] pt-[var(--spacing-system-l)] pb-[var(--spacing-system-l)] -mt-[var(--spacing-system-l)]">
          <TagFilterBarSkeleton
            search=""
            onSearchChange={noop}
            placeholder="Search for Ticket"
            filterButton={mobileFilterButton}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-[var(--spacing-system-l)]">
          <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
            <TagFilterBarSkeleton
              search=""
              onSearchChange={noop}
              placeholder="Search for Ticket"
              filterButton={mobileFilterButton}
            />
          </div>
          {/* Mobile keeps these filters in the modal next to the search input. */}
          <div className="hidden md:grid grid-cols-4 gap-[var(--spacing-system-l)]">
            <Autocomplete
              multiple
              options={EMPTY_OPTIONS}
              value={EMPTY_VALUE}
              onChange={noop}
              placeholder="Show All Customers"
              loading
              startAdornment={<Filter02Icon className="size-6 text-ods-text-secondary" />}
              className="col-span-1"
            />
            <Autocomplete
              multiple
              options={EMPTY_OPTIONS}
              value={EMPTY_VALUE}
              onChange={noop}
              placeholder="Show All Employees"
              loading
              startAdornment={<Filter02Icon className="size-6 text-ods-text-secondary" />}
              className="col-span-1"
            />
          </div>
        </div>
      )}

      {isTable ? (
        <TableSkeleton columns={COLUMNS} />
      ) : (
        <div aria-busy className="flex-1 min-h-0 -mx-[var(--spacing-system-l)]">
          <Board columns={boardColumns} onChange={noop} className="h-full px-[var(--spacing-system-l)]" />
        </div>
      )}
    </PageLayout>
  );
}
