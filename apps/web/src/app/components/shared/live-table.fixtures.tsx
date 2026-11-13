import {
  type ColumnDef,
  DataTable,
  LoadingScope,
  TruncateText,
  useDataTable,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { LiveTable, type LiveTableProps } from './live-table';

/**
 * A small list drawn through `LiveTable`, for the tests that lock its card markup and the ones that cover its grid
 * layout: both render the same tables. Columns carry what the grid needs (a `size`, a one-line `gridCell`, a label),
 * which the card layout does not read.
 */

export interface FixtureRow {
  id: string;
  name?: string;
  role?: string;
  note?: string;
}

export const FIXTURE_ROWS: FixtureRow[] = [
  { id: 'r-1', name: 'Maya Chen', role: 'Admin', note: 'Owns the workspace' },
  { id: 'r-2', name: 'Jerome Park', role: 'Technician' },
];

export const FIXTURE_PAGE_SIZE = 2;

export const FIXTURE_COLUMNS: ColumnDef<FixtureRow>[] = [
  {
    id: 'name',
    header: 'NAME',
    size: 240,
    cell: ({ row }) => <TruncateText>{row.original.name ?? ''}</TruncateText>,
    meta: {
      width: 'flex-1 min-w-0',
      label: 'Name',
      gridCell: ({ row }) => <DataTable.Cell text={row.original.name ?? ''} />,
    },
  },
  {
    id: 'role',
    header: 'ROLE',
    size: 160,
    cell: ({ row }) => <TruncateText>{row.original.role ?? ''}</TruncateText>,
    meta: {
      width: 'w-40',
      label: 'Role',
      sortable: true,
      gridCell: ({ row }) => <DataTable.Cell text={row.original.role ?? ''} />,
    },
  },
];

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Everything `LiveTable` takes beside its rows: what a test varies. */
export type LiveTableOptions = Partial<
  DistributiveOmit<LiveTableProps<FixtureRow>, 'table' | 'columns' | 'pageSize' | 'skeletonRows'>
>;

const getRowId = (row: FixtureRow) => row.id;
const rowHref = (row: FixtureRow) => `/people/${row.id}`;

/** The loaded list: two rows, a row link, a server total. */
export function LoadedLiveTable({ rows = FIXTURE_ROWS, ...options }: LiveTableOptions & { rows?: FixtureRow[] }) {
  const table = useDataTable<FixtureRow>({ data: rows, columns: FIXTURE_COLUMNS, getRowId, enableSorting: false });
  return (
    <LiveTable
      table={table}
      pageSize={FIXTURE_PAGE_SIZE}
      itemName="result"
      totalCount={rows.length}
      rowHref={rowHref}
      emptyState={{ title: 'No people found', description: 'Try adjusting your search.' }}
      {...options}
    />
  );
}

/** The list before its first page answers: the `columns` form, in the caller's loading scope. */
export function LoadingLiveTable(options: LiveTableOptions) {
  return (
    <LoadingScope>
      <LiveTable columns={FIXTURE_COLUMNS} pageSize={FIXTURE_PAGE_SIZE} itemName="result" {...options} />
    </LoadingScope>
  );
}

/** jsdom has no `IntersectionObserver` and the infinite footer makes one. A test brings its sentinel into view. */
export class SentinelObserver {
  static readonly watching = new Set<SentinelObserver>();

  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(): void {
    SentinelObserver.watching.add(this);
  }

  unobserve(): void {}

  disconnect(): void {
    SentinelObserver.watching.delete(this);
  }

  /** The sentinel scrolled into view. */
  intersect(): void {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

/** A mounted element: its container, and how to render again or unmount. */
export interface Mounted {
  container: HTMLDivElement;
  rerender: (element: ReactElement) => void;
  unmount: () => void;
}

const mounted = new Set<{ root: Root; container: HTMLDivElement }>();

/** Renders into a fresh container in the document (the app's tests use no testing library). */
export function mount(element: ReactElement): Mounted {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const entry = { root, container };
  mounted.add(entry);
  act(() => root.render(element));
  return {
    container,
    rerender: next => act(() => root.render(next)),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
      mounted.delete(entry);
    },
  };
}

/** Unmounts everything `mount` rendered: call it after each test. */
export function unmountAll(): void {
  for (const entry of [...mounted]) {
    act(() => entry.root.unmount());
    entry.container.remove();
    mounted.delete(entry);
  }
  SentinelObserver.watching.clear();
}
