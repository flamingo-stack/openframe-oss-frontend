/**
 * The report on a query's page (its "Query Results" tab) follows the app's one table flag: the grid table where the
 * flag is on, card rows where it is off, and its loading rows until the flag is answered. Over the real page view and
 * the lib's `QueryReportTable`, with the page's reads given as a loaded query and a loaded report.
 */

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  answerTableFlag,
  gridHeaderColumns,
  gridLoadingHeaderCells,
  gridRoot,
  gridSettingsGear,
  hasGridMarkup,
  stubLayoutApis,
} from '@/app/hooks/use-table-layout.fixtures';
import { QueryDetailsView } from './query-details-view';

/** The report the page reads: what `useQueryReport` returns, in the state a test names. */
const report = vi.hoisted(() => {
  const rows = [
    { device: 'reception-01', last_fetched: 'Nov 20, 2026', pid: '1234', name: 'chrome' },
    { device: 'maya-mba', last_fetched: 'Nov 21, 2026', pid: '5678', name: 'node' },
  ];
  const base = { reportClipped: false, error: null, refetch: () => undefined };
  return {
    loaded: { ...base, rows, isLoading: false },
    reading: { ...base, rows: [] as typeof rows, isLoading: true },
    current: null as unknown,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, back: () => undefined }),
  usePathname: () => '/monitoring/query',
  useSearchParams: () => new URLSearchParams('id=7'),
}));
vi.mock('../hooks/use-query-report', () => ({ useQueryReport: () => report.current }));
vi.mock('../hooks/use-query-details', () => ({
  useQueryDetails: () => ({
    queryDetails: { name: 'Running processes', description: 'Every process', interval: 3600, query: 'select 1;' },
    isLoading: false,
    error: null,
  }),
}));
vi.mock('../../hooks/use-queries', () => ({ useQueries: () => ({ deleteQuery: () => undefined, isDeleting: false }) }));
vi.mock('../../policy/hooks/use-policy-devices', () => ({
  usePolicyDevices: () => ({ devices: [], isLoading: false }),
}));
vi.mock('../../../mingo/context/use-track-open-view', () => ({ useTrackOpenView: () => undefined }));
vi.mock('@/app/hooks/use-safe-back', () => ({ useSafeBack: () => () => undefined }));
// Nothing of these is under test here: the SQL editor is Monaco, the rest read the network.
vi.mock('../../../scripts/shared/components/script-editor', () => ({ ScriptEditor: () => null }));
vi.mock('../../components/test-query-section', () => ({ TestQuerySection: () => null }));
vi.mock('../../components/confirm-delete-monitoring-modal', () => ({ ConfirmDeleteMonitoringModal: () => null }));
vi.mock('./query-devices-table', () => ({ QueryDevicesTable: () => null }));

describe('the report on a query’s page, by the table flag', () => {
  let container: HTMLDivElement;
  let root: Root;

  const draw = (element: ReactElement) => act(() => root.render(element));
  const page = <QueryDetailsView queryId="7" />;

  beforeEach(() => {
    stubLayoutApis();
    report.current = report.loaded;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    answerTableFlag('loading');
  });

  it('draws the report as the grid table while the flag is on, the device and the fetch time first', () => {
    answerTableFlag('on');
    draw(page);
    expect(gridRoot(container)).not.toBeNull();
    expect(gridHeaderColumns(container)).toEqual(['device', 'last_fetched', 'pid', 'name']);
    // The columns are the query's own: no saved layout, so no gear.
    expect(gridSettingsGear(container)).toBeNull();
    expect(container.textContent).toContain('chrome');
  });

  it('draws card rows while the flag is off', () => {
    answerTableFlag('off');
    draw(page);
    expect(hasGridMarkup(container)).toBe(false);
    expect(container.textContent).toContain('chrome');
  });

  it('draws its loading rows until the flag is answered, then the grid: no layout to swap', () => {
    answerTableFlag('loading');
    draw(page);
    expect(hasGridMarkup(container)).toBe(false);
    expect(container.textContent).not.toContain('chrome');

    act(() => answerTableFlag('on'));
    expect(gridRoot(container)).not.toBeNull();
    expect(container.textContent).toContain('chrome');
  });

  it('draws the grid’s loading form while the report is read, with the flag on', () => {
    answerTableFlag('on');
    report.current = report.reading;
    draw(page);
    expect(gridRoot(container)).not.toBeNull();
    expect(gridLoadingHeaderCells(container).length).toBeGreaterThan(0);
  });
});
