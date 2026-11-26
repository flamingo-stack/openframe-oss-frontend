/**
 * `LiveTable` passes the grid layout on to its `DataTable`: `layout`, `maxHeight`, `settings`. A list switches by
 * passing `layout="grid"`; a list that passes nothing stays on card rows (its markup is locked in
 * `live-table-cards-markup.test.tsx`). In the grid the shell's own parts keep working: the loading rows, the dim
 * during a refetch, the infinite footer, the results count.
 */

import { act } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { FIRST_PAGE_FOOTER } from '@/app/hooks/cursor-pager.fixtures';
import {
  FIXTURE_PAGE_SIZE,
  LoadedLiveTable,
  LoadingLiveTable,
  mount,
  SentinelObserver,
  unmountAll,
} from './live-table.fixtures';

const noop = () => {};

beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', SentinelObserver);
});
afterEach(() => {
  unmountAll();
  window.localStorage.clear();
});

const gridRoot = (container: HTMLElement) => container.querySelector('[data-grid-root]');
const gridHeader = (container: HTMLElement) => container.querySelector('[data-grid-header]');
const gridBody = (container: HTMLElement) => container.querySelector('[data-grid-body]');
/** The results row above a grid table. */
const metaRow = (container: HTMLElement) => container.querySelector('[data-grid-meta]');
/** The grid's own scroll viewport: there only when the table states a height. */
const fixedViewport = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[style*="--data-table-max-height"]');
const settingsGear = (container: HTMLElement) => container.querySelector('[data-grid-settings-cell]');
/** The infinite footer's sentinel. */
const sentinel = (scope: ParentNode) => scope.querySelector('div.h-1[aria-hidden="true"]');
/** The header cells of a loading grid table: a bar in the label's place. */
const loadingHeaderCells = (container: HTMLElement) =>
  gridHeader(container)?.querySelectorAll('[data-grid-header-loading]') ?? [];
/** The ids of the columns the grid header draws, in order. */
const headerColumns = (container: HTMLElement) =>
  [...(gridHeader(container)?.querySelectorAll('[data-grid-header-cell]') ?? [])].map(cell =>
    cell.getAttribute('data-grid-col'),
  );

describe('LiveTable, card layout (the default)', () => {
  it('draws no grid unless asked', () => {
    const { container } = mount(<LoadedLiveTable />);
    expect(container.innerHTML).not.toContain('data-grid-');
  });

  it('drops the height and the settings: the same markup as a list that passes nothing', () => {
    const plain = mount(<LoadedLiveTable />);
    const withGridOptions = mount(<LoadedLiveTable maxHeight={360} settings={{ storageKey: 'unused' }} />);
    const cards = mount(<LoadedLiveTable layout="cards" maxHeight="fill" settings={{}} />);

    expect(withGridOptions.container.innerHTML).toBe(plain.container.innerHTML);
    expect(cards.container.innerHTML).toBe(plain.container.innerHTML);
  });
});

describe('LiveTable, grid layout', () => {
  it('draws the grid table with the results count above it', () => {
    const { container } = mount(<LoadedLiveTable layout="grid" />);

    expect(gridRoot(container)).not.toBeNull();
    expect(headerColumns(container)).toEqual(['name', 'role']);
    expect(gridBody(container)?.textContent).toContain('Maya Chen');
    expect(metaRow(container)?.textContent).toContain('2 results');
    // Nothing else was asked for: the page scrolls (no viewport of the table's own) and there is no gear.
    expect(fixedViewport(container)).toBeNull();
    expect(settingsGear(container)).toBeNull();
  });

  it('is the grid at every width: no card rows in the tree, no card-row gap between the grid rows', () => {
    const cards = mount(<LoadedLiveTable />);
    const grid = mount(<LoadedLiveTable layout="grid" />);
    // `LiveTable`'s row gap is a card-row option: the card rows carry it, the grid rows touch.
    expect(cards.container.innerHTML).toContain('mb-1');
    expect(grid.container.innerHTML).not.toContain('mb-1');
    // Each row is drawn once, as a grid row.
    expect(grid.container.textContent?.split('Maya Chen')).toHaveLength(2);
  });

  it('leaves the results count out when the list hides it, and the whole header with `showHeader={false}`', () => {
    const noCount = mount(<LoadedLiveTable layout="grid" showRowCount={false} />);
    expect(metaRow(noCount.container)).toBeNull();
    expect(gridHeader(noCount.container)).not.toBeNull();

    const noHeader = mount(<LoadedLiveTable layout="grid" showHeader={false} />);
    expect(metaRow(noHeader.container)).toBeNull();
    expect(gridHeader(noHeader.container)).toBeNull();
    expect(gridBody(noHeader.container)).not.toBeNull();
  });

  it('sticks the header under the page toolbar while the page scrolls (no height stated)', () => {
    const { container } = mount(<LoadedLiveTable layout="grid" stickyHeaderOffset="top-[56px]" />);
    expect(gridHeader(container)?.className).toContain('sticky');
    expect(gridHeader(container)?.className).toContain('top-[56px]');
  });

  it('hands the grid its height: the table is its own scroll viewport, the count stays above it', () => {
    const { container } = mount(<LoadedLiveTable layout="grid" maxHeight={360} />);
    const viewport = fixedViewport(container);

    expect(viewport?.style.getPropertyValue('--data-table-max-height')).toBe('360px');
    expect(viewport?.querySelector('[data-grid-header]')).not.toBeNull();
    expect(viewport?.querySelector('[data-grid-body]')).not.toBeNull();
    expect(viewport?.querySelector('[data-grid-meta]')).toBeNull();
    expect(metaRow(container)).not.toBeNull();
  });

  it('hands the grid its settings: the gear, and a layout the viewer saved under the storage key', () => {
    const gear = mount(<LoadedLiveTable layout="grid" settings={{}} />);
    expect(settingsGear(gear.container)).not.toBeNull();

    window.localStorage.setItem(
      'ods-data-table:fixture-people',
      JSON.stringify({ version: 1, order: [], hidden: ['role'], sizing: {} }),
    );
    const saved = mount(<LoadedLiveTable layout="grid" settings={{ storageKey: 'fixture-people' }} />);
    expect(headerColumns(saved.container)).toEqual(['name']);
  });

  it('draws one page of loading rows before the first page answers (the columns form)', () => {
    const { container } = mount(<LoadingLiveTable layout="grid" maxHeight="fill" settings={{}} />);

    expect(gridBody(container)?.querySelectorAll('[data-loading-item]')).toHaveLength(FIXTURE_PAGE_SIZE);
    // The loading table is the loaded table's frame: the same viewport and gear, and a header that names no column
    // yet (one bar per column, no sort or filter control).
    expect(loadingHeaderCells(container)).toHaveLength(2);
    expect(headerColumns(container)).toEqual([null, null]);
    expect(fixedViewport(container)).not.toBeNull();
    expect(settingsGear(container)).not.toBeNull();
    expect(metaRow(container)).not.toBeNull();
  });

  it('draws a loaded list that is still read (`loadingCells`) as loading rows with their cells', () => {
    const { container } = mount(<LoadedLiveTable layout="grid" loadingCells />);
    expect(gridBody(container)?.querySelectorAll('[data-loading-item]')).toHaveLength(2);
    // The header gets what the body gets: no column is named while the list is read.
    expect(loadingHeaderCells(container)).toHaveLength(2);
  });

  it('names its columns once loaded', () => {
    const { container } = mount(<LoadedLiveTable layout="grid" />);
    expect(loadingHeaderCells(container)).toHaveLength(0);
  });

  it('dims the rows of a refetch in flight, and only then', () => {
    const { container, rerender } = mount(<LoadedLiveTable layout="grid" isPending />);
    const dim = gridRoot(container)?.parentElement;
    expect(dim?.className).toContain('opacity-60');

    rerender(<LoadedLiveTable layout="grid" />);
    expect(gridRoot(container)?.parentElement?.className).not.toContain('opacity-60');
    // The same table, not a new one: the rows were dimmed, never unmounted.
    expect(gridRoot(container)?.parentElement).toBe(dim);
  });

  it('draws the empty state inside the table', () => {
    const { container } = mount(<LoadedLiveTable layout="grid" rows={[]} />);
    expect(gridBody(container)?.textContent).toContain('No people found');
  });

  it("draws a row's sub-row", () => {
    const { container } = mount(
      <LoadedLiveTable layout="grid" renderSubRow={row => (row.note ? <p data-sub-row>{row.note}</p> : null)} />,
    );
    expect(gridBody(container)?.querySelector('[data-sub-row]')?.textContent).toBe('Owns the workspace');
  });

  it('shows the server sort on the header and reports a click', () => {
    const onSortChange = vi.fn();
    const { container } = mount(
      <LoadedLiveTable layout="grid" sort={{ id: 'role', desc: true }} onSortChange={onSortChange} />,
    );
    const roleHeader = gridHeader(container)?.querySelector<HTMLElement>('[data-grid-col="role"]');
    // The sorted column's label is drawn as applied (primary text), and its header cell is the control.
    expect(roleHeader?.querySelector('.text-ods-text-primary')?.textContent).toBe('ROLE');
    act(() => roleHeader?.click());
    expect(onSortChange).toHaveBeenCalledWith('role');
  });

  describe('the infinite footer', () => {
    it('keeps its sentinel inside the table when the table scrolls itself, and loads the next page from it', () => {
      const onLoadMore = vi.fn();
      const { container } = mount(
        <LoadedLiveTable
          layout="grid"
          maxHeight="fill"
          footer={{ hasNextPage: true, isFetchingNextPage: false, onLoadMore }}
        />,
      );
      const viewport = fixedViewport(container);
      expect(viewport).not.toBeNull();
      expect(viewport && sentinel(viewport)).not.toBeNull();

      act(() => {
        for (const observer of SentinelObserver.watching) observer.intersect();
      });
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('loads the next page while the page scrolls (no height stated)', () => {
      const onLoadMore = vi.fn();
      const { container } = mount(
        <LoadedLiveTable layout="grid" footer={{ hasNextPage: true, isFetchingNextPage: false, onLoadMore }} />,
      );
      expect(sentinel(container)).not.toBeNull();

      act(() => {
        for (const observer of SentinelObserver.watching) observer.intersect();
      });
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('draws the next page as loading grid rows after the loaded ones', () => {
      const { container } = mount(
        <LoadedLiveTable layout="grid" footer={{ hasNextPage: true, isFetchingNextPage: true, onLoadMore: noop }} />,
      );
      // Two loaded rows and one page of loading rows, all in the grid body: none drawn by the footer under the table.
      expect(gridBody(container)?.querySelectorAll('[data-loading-item]')).toHaveLength(2 + FIXTURE_PAGE_SIZE);
    });

    it('draws no footer without one', () => {
      const { container } = mount(<LoadedLiveTable layout="grid" footer={null} />);
      expect(sentinel(container)).toBeNull();
    });
  });
});

describe('LiveTable pager', () => {
  const PAGE_3 = {
    ...FIRST_PAGE_FOOTER,
    isFirstPage: false,
    hasNextPage: true,
    hasPreviousPage: true,
    page: 3,
    startCursor: 's3',
    endCursor: 'e3',
    rangeStart: 41,
  };
  const disabled = (container: HTMLElement) =>
    ['Go to first page', 'Go to previous page', 'Go to next page'].map(
      label => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.disabled,
    );

  it('pages while the rows on screen are its page, and waits while the next one is read', () => {
    const { container, rerender } = mount(<LoadedLiveTable pager={PAGE_3} />);
    expect(disabled(container)).toEqual([false, false, false]);

    // The next page is read: the rows on screen are the last page's, so a second Next would resend its cursor.
    rerender(<LoadedLiveTable pager={PAGE_3} isPending />);
    expect(disabled(container)).toEqual([true, true, true]);
    // The range stays while the buttons wait.
    expect(container.textContent).toContain('41–42');
  });

  it('sits in the row above the table, the range in place of the count, on cards and in the grid', () => {
    for (const layout of ['cards', 'grid'] as const) {
      const { container } = mount(<LoadedLiveTable layout={layout} pager={PAGE_3} totalCount={60} />);
      const meta = container.querySelector('[data-table-meta]');
      expect(meta?.querySelector('nav[aria-label="Pagination"]')).not.toBeNull();
      expect(meta?.textContent).toContain('41–42 of 60 results');
      // The count is not drawn a second time in the card header.
      expect(container.textContent?.split('results')).toHaveLength(2);
    }
  });

  it('has no First on page 2: Previous is the way to page 1', () => {
    const { container } = mount(<LoadedLiveTable pager={{ ...PAGE_3, page: 2, rangeStart: 21 }} />);
    expect(disabled(container)).toEqual([undefined, false, false]);
  });

  it('draws the pager waiting while a paged list reads its first page (`pager={null}`)', () => {
    const { container } = mount(<LoadingLiveTable pager={null} />);
    expect(disabled(container)).toEqual([undefined, true, true]);
  });

  it('draws no pager on an empty first page', () => {
    const { container } = mount(<LoadedLiveTable rows={[]} pager={FIRST_PAGE_FOOTER} />);
    expect(container.querySelector('nav[aria-label="Pagination"]')).toBeNull();
  });
});
