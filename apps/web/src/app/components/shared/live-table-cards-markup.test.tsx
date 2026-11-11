/**
 * `LiveTable`'s card layout, locked as markup: loaded, loading and empty.
 *
 * These snapshots were recorded BEFORE `LiveTable` learned the grid layout (`layout`, `maxHeight`, `settings`), and
 * that change left them untouched: a list that does not ask for the grid renders what it rendered before. A list that
 * moves to the grid keeps its card rows below `md`. Update a snapshot only for a change that means to alter the card
 * layout.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LoadedLiveTable, LoadingLiveTable, mount, SentinelObserver, unmountAll } from './live-table.fixtures';

const noop = () => {};

beforeAll(() => {
  vi.stubGlobal('IntersectionObserver', SentinelObserver);
});
afterEach(unmountAll);

describe('LiveTable, card layout (the default)', () => {
  it('loaded, with a next page', () => {
    const { container } = mount(
      <LoadedLiveTable
        stickyHeaderOffset="top-[56px]"
        footer={{ hasNextPage: true, isFetchingNextPage: false, onLoadMore: noop }}
      />,
    );
    expect(container.innerHTML).not.toContain('data-grid-');
    expect(container).toMatchSnapshot();
  });

  it('loaded, sorted, a refetch in flight, a sub-row and a row class', () => {
    const { container } = mount(
      <LoadedLiveTable
        isPending
        sort={{ id: 'role', desc: true }}
        onSortChange={noop}
        rowClassName={row => (row.id === 'r-1' ? 'bg-ods-card' : '')}
        renderSubRow={row => (row.note ? <p data-sub-row>{row.note}</p> : null)}
      />,
    );
    expect(container).toMatchSnapshot();
  });

  it('loaded, without the header', () => {
    const { container } = mount(<LoadedLiveTable showHeader={false} />);
    expect(container).toMatchSnapshot();
  });

  it('loading: the columns form, one page of loading rows', () => {
    const { container } = mount(<LoadingLiveTable />);
    expect(container).toMatchSnapshot();
  });

  it('empty', () => {
    const { container } = mount(<LoadedLiveTable rows={[]} />);
    expect(container).toMatchSnapshot();
  });
});
