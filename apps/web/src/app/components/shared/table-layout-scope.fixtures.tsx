import type { ReactElement } from 'react';
import { mount } from './live-table.fixtures';
import { TableLayoutScope } from './table-layout-scope';

/**
 * What the tests of a table under a page's `TableLayoutScope` share: the table mounted the way its page mounts it,
 * beside the flag's answers and the parts of a grid table every table test looks for.
 */
export {
  fixedViewport,
  gridBodyText,
  gridColumns,
  gridRoot,
  loadingHeaderCells,
  setTableGridFlag,
  settingsGear,
  twoLineCells,
} from './table-grid-flag.fixtures';

/** Mounts a table the way its page does: under the page's scope. `fill`: a list page, whose table is its content. */
export function mountInScope(table: ReactElement, { fill = false }: { fill?: boolean } = {}) {
  return mount(<TableLayoutScope fill={fill}>{table}</TableLayoutScope>);
}
