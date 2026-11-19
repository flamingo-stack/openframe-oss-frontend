import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

/**
 * What the tests of a screen's tables share: the app's table flag (`data-table-grid`) in each of its answers, the
 * parts of a grid table a test looks for, and the browser APIs the lib's table reads that jsdom does not have.
 */

/** The server's answer for `data-table-grid`; `'loading'` is before any answer. */
export function setTableGridFlag(answer: 'on' | 'off' | 'loading'): void {
  const store = useFeatureFlagsStore.getState();
  store.reset();
  if (answer !== 'loading') store.setFlags([{ name: 'data-table-grid', enabled: answer === 'on' }]);
}

export const gridRoot = (scope: ParentNode) => scope.querySelector('[data-grid-root]');
/** The ids of the data columns a grid header draws, in order (an action column and a loading header name none). */
export const gridColumns = (scope: ParentNode) =>
  [...scope.querySelectorAll('[data-grid-header] [data-grid-header-cell][data-grid-col]')].map(cell =>
    cell.getAttribute('data-grid-col'),
  );
/** The header cells of a loading grid table: a bar in the label's place. */
export const loadingHeaderCells = (scope: ParentNode) => scope.querySelectorAll('[data-grid-header-loading]');
/** The gear of the saved column settings. */
export const settingsGear = (scope: ParentNode) => scope.querySelector('[data-grid-settings-cell]');
/** The grid's own scroll viewport: there only when the table states a height (`fill`). */
export const fixedViewport = (scope: ParentNode) => scope.querySelector('[style*="--data-table-max-height"]');
/** The results row above a grid table. */
export const metaRow = (scope: ParentNode) => scope.querySelector('[data-grid-meta]');
/** The text of a grid table's body. */
export const gridBodyText = (scope: ParentNode) => scope.querySelector('[data-grid-body]')?.textContent ?? '';
/** No second line anywhere in the grid's rows: every card cell's two-line column is gone. */
export const twoLineCells = (scope: ParentNode) => scope.querySelectorAll('[data-grid-body] .flex-col');

/**
 * A viewer's saved column layout under a table's `storageKey`, with one column hidden: a table that keeps its layout
 * under that key mounts without the column, and a table with another key keeps it.
 */
export function saveHiddenColumn(storageKey: string, columnId: string): void {
  window.localStorage.setItem(
    `ods-data-table:${storageKey}`,
    JSON.stringify({ version: 1, order: [], hidden: [columnId], sizing: {} }),
  );
}

class ObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

/** The lib measures text and the table's box, and reads viewport queries; jsdom has none of them. */
export function stubTableBrowserApis(): void {
  globalThis.ResizeObserver ??= ObserverStub as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver ??= ObserverStub as unknown as typeof IntersectionObserver;
  window.matchMedia ??= ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}
