// Every new list key is a first-page request, so the tab's filter logic is pinned
// by the keys it hands the list: one per user action, none for a rejected search.
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type ReactRelay from 'react-relay';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `graphql` tags are compiled away by the relay babel transform, which vitest
// does not run; the tail helpers' module graph declares one.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<typeof ReactRelay>()),
  graphql: () => ({}),
}));

let search = new URLSearchParams();
vi.mock('next/navigation', () => ({ useSearchParams: () => search }));

const DEFAULT_PARAMS = { logSearch: '', logLevels: [] as string[], logRange: '24h', logFrom: '', logTo: '' };
let url: Partial<typeof DEFAULT_PARAMS> = {};
let writes: Partial<typeof DEFAULT_PARAMS>[] = [];
// The router lands a write one navigation later, never in the render that asked for it.
vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApiParams: () => ({
    params: { ...DEFAULT_PARAMS, ...url },
    setParam: (key: string, value: unknown) => writes.push({ [key]: value }),
    setParams: (next: Partial<typeof DEFAULT_PARAMS>) => writes.push(next),
  }),
}));

vi.mock('@/app/components/shared', () => ({
  ContentErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));

interface ContentProps {
  list: AgentLogsList;
  onResetFilters: () => void;
}
let contentProps: ContentProps[] = [];
vi.mock('./agent-logs-content', () => ({
  AgentLogsContent: (props: ContentProps) => {
    contentProps.push(props);
    return null;
  },
}));

interface ToolbarProps {
  onRangeChange: (range: DeviceLogRangePreset) => void;
  onRefresh: () => void;
}
let toolbar: ToolbarProps | null = null;
vi.mock('./agent-logs-toolbar', () => ({
  AgentLogsToolbar: (props: ToolbarProps) => {
    toolbar = props;
    return null;
  },
}));
vi.mock('./agent-logs-error-state', () => ({ AgentLogsErrorState: () => null }));
vi.mock('./agent-logs-skeleton', () => ({ AgentLogsListSkeleton: () => null }));

import type { Device } from '../../../types/device.types';
import { DEVICE_LOGS_CLOCK_SKEW_MS } from '../../../utils/device-log-tail';
import type { DeviceLogRangePreset } from '../../../utils/device-log-time';
import type { AgentLogsList } from './agent-logs-content';
import { AgentLogsTab } from './agent-logs-tab';

const NOW = Date.parse('2026-09-23T10:00:00.000Z');
const device = { id: 'd-1', machineId: 'machine-1', hostname: 'host-1' } as Device;
let container: HTMLDivElement;
let root: Root;

function render() {
  act(() => {
    root.render(<AgentLogsTab device={device} />);
  });
}

/** The router catching up: pending writes reach the URL and the tab re-renders. */
function land() {
  url = Object.assign({ ...url }, ...writes);
  writes = [];
  render();
}

/** Distinct list keys handed to the list, in order: each is one first-page request. */
function listKeys(): string[] {
  return [...new Set(contentProps.map(props => props.list.key))];
}

function latestList(): AgentLogsList {
  return contentProps[contentProps.length - 1].list;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  search = new URLSearchParams();
  url = {};
  writes = [];
  contentProps = [];
  toolbar = null;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('AgentLogsTab list requests', () => {
  it('starts auto-update of an empty list at its anchor, not at the start of its window', () => {
    render();
    expect(latestList().filter.from).toBe('2026-09-22T10:00:00.000Z');
    expect(latestList().emptyFrom).toBe(new Date(NOW - DEVICE_LOGS_CLOCK_SKEW_MS).toISOString());
  });

  it('asks once per preset change, at the moment of the click, not a stale-range list first', () => {
    render();
    vi.setSystemTime(NOW + 60_000);
    act(() => toolbar?.onRangeChange('1h'));
    vi.setSystemTime(NOW + 61_000);
    land();

    expect(listKeys()).toHaveLength(2);
    expect(latestList().filter.from).toBe(new Date(NOW + 60_000 - 3_600_000).toISOString());
  });

  it('asks once for a Reset of search, levels and range together', () => {
    url = { logSearch: 'timeout', logLevels: ['ERROR'], logRange: '1h' };
    render();
    expect(latestList().filter).toMatchObject({ contains: ['timeout'], levels: ['ERROR'] });

    act(() => contentProps[contentProps.length - 1].onResetFilters());
    land();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    land();

    expect(listKeys()).toHaveLength(2);
    expect(latestList().filter.contains).toBeUndefined();
    expect(latestList().filter.levels).toBeUndefined();
  });

  it('never sends a search from a shared link that the limits reject', () => {
    url = { logSearch: 'one two three four five six' };
    render();
    expect(contentProps.every(props => props.list.filter.contains === undefined)).toBe(true);
  });

  it('keeps the last accepted search when the text turns invalid', () => {
    url = { logSearch: 'timeout' };
    render();
    url = { logSearch: '(?=timeout' };
    render();
    expect(latestList().filter.contains).toEqual(['timeout']);
    expect(listKeys()).toHaveLength(1);
  });

  it('reloads once for a newer refresh stamp, and not on Back to the older one', () => {
    search = new URLSearchParams({ refresh: String(NOW - 5_000) });
    render();
    search = new URLSearchParams({ refresh: String(NOW + 5_000) });
    render();
    search = new URLSearchParams({ refresh: String(NOW - 5_000) });
    render();

    expect(listKeys()).toHaveLength(2);
  });

  it('reloads once for the Refresh button', () => {
    render();
    vi.setSystemTime(NOW + 30_000);
    act(() => toolbar?.onRefresh());
    expect(listKeys()).toHaveLength(2);
  });
});
