/**
 * The Logging step's preview table follows the app's one table flag: the grid table where it is on, card rows where it
 * is off, loading rows until it is answered. A three-row preview in a tour step: the grid has no gear and no height
 * of its own. The open button is its action column, and the card layout's columns are what they were.
 */

import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmountAll } from '@/app/components/shared/live-table.fixtures';
import {
  answerTableFlag,
  gridHeaderColumns,
  gridRoot,
  gridSettingsGear,
  gridViewport,
  hasGridMarkup,
  stubLayoutApis,
} from '@/app/hooks/use-table-layout.fixtures';

interface SeenColumn {
  id?: string;
  accessorKey?: string;
  size?: number;
  meta?: { width?: string; hideAt?: string; align?: string; gridKind?: string };
}

/** The columns the table handed `useDataTable`: what the two layouts read of them. */
const seen = vi.hoisted(() => ({ columns: [] as SeenColumn[] }));

vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => {
  const actual = await importOriginal<{ useDataTable: (options: { columns: SeenColumn[] }) => unknown }>();
  return {
    ...actual,
    useDataTable: (options: { columns: SeenColumn[] }) => {
      seen.columns = options.columns;
      return actual.useDataTable(options);
    },
  };
});

// The shared barrel reaches modules with Relay tags, which need the Babel transform vitest does not run.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, back: () => undefined }),
  usePathname: () => '/onboarding',
  useSearchParams: () => new URLSearchParams(),
}));

const LOG = {
  toolEventId: 'evt-1001',
  ingestDay: '2026-10-28',
  toolType: 'OPENFRAME',
  eventType: 'DEVICE_ONLINE',
  severity: 'INFO',
  timestamp: '2026-10-28T09:00:00Z',
  summary: 'Device came online',
  hostname: 'srv-db-prod-02',
  organizationName: 'Acme Clinic',
};

vi.mock('../../logs-page/hooks/use-logs', () => ({
  useLogs: () => ({ logs: [LOG], isLoading: false }),
}));

import { LoggingStep } from './logging-step';

const settle = async () => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
  });
};
/** What the card layout reads of each column. */
const cardMeta = () =>
  seen.columns.map(({ id, accessorKey, meta }) => [id ?? accessorKey, meta?.width, meta?.hideAt, meta?.align]);
/** The grid's action columns. */
const gridActions = () =>
  seen.columns.filter(column => column.meta?.gridKind === 'action').map(({ id, size }) => [id, size]);

beforeEach(() => {
  stubLayoutApis();
  seen.columns = [];
});

afterEach(() => {
  unmountAll();
  answerTableFlag('loading');
  window.localStorage.clear();
});

async function step() {
  const mounted = mount(<LoggingStep />);
  await settle();
  return mounted.container;
}
const openButton = (container: HTMLElement) => container.querySelector('button[aria-label="Open log in new tab"]');

describe('LoggingStep', () => {
  it('flag off: card rows, the open button outlined', async () => {
    answerTableFlag('off');
    const container = await step();

    expect(container.textContent).toContain('Device came online');
    expect(hasGridMarkup(container)).toBe(false);
    expect(openButton(container)?.className).toContain('bg-ods-card');
  });

  it('flag on: the grid table, no gear and no height of its own, the open button in its action column', async () => {
    answerTableFlag('on');
    const container = await step();

    expect(gridRoot(container)).not.toBeNull();
    expect(gridHeaderColumns(container)).toEqual(['logId', 'status', 'tool', 'source', 'description']);
    expect(container.textContent).toContain('Device came online');
    expect(gridSettingsGear(container)).toBeNull();
    expect(gridViewport(container)).toBeNull();
    expect(gridActions()).toEqual([['open', 56]]);
    expect(openButton(container)?.className).toContain('border-0');
  });

  it('flag not answered: loading rows, no log drawn in either layout', async () => {
    answerTableFlag('loading');
    const container = await step();

    expect(container.textContent).not.toContain('Device came online');
    expect(hasGridMarkup(container)).toBe(false);
  });

  it("keeps the card layout's columns: the open column still hides below md", async () => {
    answerTableFlag('off');
    await step();

    expect(cardMeta().filter(([id]) => id !== 'tool')).toEqual([
      ['logId', 'w-[160px]', undefined, undefined],
      ['status', 'w-[96px]', undefined, undefined],
      ['source', 'w-[240px]', 'md', undefined],
      ['description', 'flex-1', 'lg', undefined],
      ['open', 'w-12 shrink-0 flex-none', 'md', 'right'],
    ]);
  });
});
