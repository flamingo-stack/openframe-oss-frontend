import { useFeatureFlagsStore } from '@/stores/feature-flags-store';

/**
 * For the tests of the screens that read the app's one table flag (`useTableGridGate`): how to put the flag in the
 * state a test names, and what a table's markup shows of its layout.
 */

/** The server's answer for `data-table-grid`: on, off, or not answered yet. */
export type TableFlagAnswer = 'on' | 'off' | 'loading';

/** Puts the flag in the state a test names. `'loading'` is the store before the flags query answers. */
export function answerTableFlag(answer: TableFlagAnswer): void {
  const store = useFeatureFlagsStore.getState();
  store.reset();
  if (answer !== 'loading') store.setFlags([{ name: 'data-table-grid', enabled: answer === 'on' }]);
}

/** The grid table's root: there only when the table draws the grid layout. */
export const gridRoot = (scope: ParentNode) => scope.querySelector('[data-grid-root]');

/** Whether anything of the grid layout is in the markup: card rows carry none of it. */
export const hasGridMarkup = (scope: HTMLElement) => scope.innerHTML.includes('data-grid-');

/** The ids of the data columns the grid header names, in order (an action column has no header cell of its own). */
export const gridHeaderColumns = (scope: ParentNode) =>
  [...scope.querySelectorAll('[data-grid-header-cell]')].map(cell => cell.getAttribute('data-grid-col'));

/** The header cells of a loading grid table: a bar in the label's place. */
export const gridLoadingHeaderCells = (scope: ParentNode) => scope.querySelectorAll('[data-grid-header-loading]');

/** The settings gear in the grid header: there only when the table passes `settings`. */
export const gridSettingsGear = (scope: ParentNode) => scope.querySelector('[data-grid-settings-cell]');

/** The grid's own scroll viewport: there only when the table states a height (`maxHeight`). */
export const gridViewport = (scope: ParentNode) => scope.querySelector('[style*="--data-table-max-height"]');

/** The results row above a grid table. */
export const gridMetaRow = (scope: ParentNode) => scope.querySelector('[data-grid-meta]');

/** jsdom has none of the layout APIs the tables and their menus reach for: a table test stubs them once. */
export function stubLayoutApis(): void {
  const Observer = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.ResizeObserver = Observer as never;
  globalThis.IntersectionObserver = Observer as never;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
  })) as never;
}
