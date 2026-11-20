/**
 * A page's `TableLayoutScope` answers "cards or grid" for the tables under it from the app's ONE table flag, and a
 * table reads the answer with `useTableGrid`. No scope above, the flag off or not answered yet: card rows.
 */

import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act, useEffect } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { mount, unmountAll } from './live-table.fixtures';
import { type TableGridProps, TableLayoutScope, useTableGrid } from './table-layout-scope';
import { setTableGridFlag } from './table-layout-scope.fixtures';

/** What a table under the scope reads, and whether it is in a loading scope. */
interface Seen {
  grid: TableGridProps;
  loading: boolean;
}
let seen: Seen | null = null;
const read = (next: Seen) => {
  seen = next;
};

/** A table under the scope: it reports what it reads once it has rendered. */
function Table({ storageKey = 'probe' }: { storageKey?: string }) {
  const grid = useTableGrid(storageKey);
  const loading = useLoadingScope();
  useEffect(() => read({ grid, loading }));
  return null;
}

afterEach(() => {
  unmountAll();
  seen = null;
  setTableGridFlag('loading');
});

describe('TableLayoutScope', () => {
  it('leaves a table with no scope above on card rows, whatever the flag says', () => {
    setTableGridFlag('on');
    mount(<Table />);
    expect(seen?.grid).toEqual({ layout: 'cards', maxHeight: undefined, settings: undefined });
  });

  it('keeps card rows while the flag is off, with no height and no settings', () => {
    setTableGridFlag('off');
    mount(
      <TableLayoutScope fill>
        <Table />
      </TableLayoutScope>,
    );
    expect(seen?.grid).toEqual({ layout: 'cards', maxHeight: undefined, settings: undefined });
    expect(seen?.loading).toBe(false);
  });

  it('draws the grid when the flag is on, with the table’s own saved settings', () => {
    setTableGridFlag('on');
    mount(
      <TableLayoutScope>
        <Table storageKey="software" />
      </TableLayoutScope>,
    );
    // A section of a longer page: the page scrolls, not the table.
    expect(seen?.grid).toEqual({ layout: 'grid', maxHeight: undefined, settings: { storageKey: 'software' } });
  });

  it('makes a list page’s table the page’s scroll area', () => {
    setTableGridFlag('on');
    mount(
      <TableLayoutScope fill>
        <Table />
      </TableLayoutScope>,
    );
    expect(seen?.grid.maxHeight).toBe('fill');
  });

  it('holds its content in a loading scope until the flag answers, so no table draws a guessed layout', () => {
    setTableGridFlag('loading');
    mount(
      <TableLayoutScope fill>
        <Table />
      </TableLayoutScope>,
    );
    expect(seen?.loading).toBe(true);
    expect(seen?.grid.layout).toBe('cards');

    act(() => setTableGridFlag('on'));
    expect(seen?.loading).toBe(false);
    expect(seen?.grid.layout).toBe('grid');
  });

  it('hands a table the same settings object across renders', () => {
    setTableGridFlag('on');
    const { rerender } = mount(
      <TableLayoutScope>
        <Table />
      </TableLayoutScope>,
    );
    const first = seen?.grid.settings;
    expect(first).toEqual({ storageKey: 'probe' });
    rerender(
      <TableLayoutScope>
        <Table />
      </TableLayoutScope>,
    );
    expect(seen?.grid.settings).toBe(first);
  });
});
