import type { ReactElement } from 'react';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { mount } from './live-table.fixtures';
import { TableLayoutScope } from './table-layout-scope';

/**
 * What the tests of a screen's tables share: the app's table flag in each of its answers, a table mounted under a
 * page's `TableLayoutScope`, and the parts of a grid table a test looks for.
 */

/** The server's answer for `data-table-grid`; `'loading'` is before any answer. */
export function setTableGridFlag(answer: 'on' | 'off' | 'loading'): void {
  const store = useFeatureFlagsStore.getState();
  store.reset();
  if (answer !== 'loading') store.setFlags([{ name: 'data-table-grid', enabled: answer === 'on' }]);
}

/** Mounts a table the way its page does: under the page's scope. `fill`: a list page, whose table is its content. */
export function mountInScope(table: ReactElement, { fill = false }: { fill?: boolean } = {}) {
  return mount(<TableLayoutScope fill={fill}>{table}</TableLayoutScope>);
}

export const gridRoot = (scope: ParentNode) => scope.querySelector('[data-grid-root]');
/** The ids of the data columns a grid header draws, in order (an action column and a loading header name none). */
export const gridColumns = (scope: ParentNode) =>
  [...scope.querySelectorAll('[data-grid-header] [data-grid-header-cell]')].map(cell =>
    cell.getAttribute('data-grid-col'),
  );
/** The gear of the saved column settings. */
export const settingsGear = (scope: ParentNode) => scope.querySelector('[data-grid-settings-cell]');
/** The grid's own scroll viewport: there only when the table states a height (`fill`). */
export const fixedViewport = (scope: ParentNode) => scope.querySelector('[style*="--data-table-max-height"]');
/** The text of a grid table's body. */
export const gridBodyText = (scope: ParentNode) => scope.querySelector('[data-grid-body]')?.textContent ?? '';
/** No second line anywhere in the grid's rows: every card cell's two-line column is gone. */
export const twoLineCells = (scope: ParentNode) => scope.querySelectorAll('[data-grid-body] .flex-col');
