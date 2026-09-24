// The Run Script "Device Logs" jump stamps `?refresh=`; Overview's logs table must
// reload for a NEW stamp, but a stamp already in the URL when the tab mounts is
// served by the table's own first fetch — reloading it again is a second request.
import { act, type Ref, useImperativeHandle } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let search = new URLSearchParams();
vi.mock('next/navigation', () => ({ useSearchParams: () => search }));

const refresh = vi.fn();
vi.mock('@/app/(app)/logs-page/components/logs-table', () => ({
  LogsTable: ({ ref }: { ref?: Ref<{ refresh: () => void }> }) => {
    useImperativeHandle(ref, () => ({ refresh }));
    return null;
  },
}));
vi.mock('../device-info-section', () => ({ DeviceInfoSection: () => null }));
vi.mock('../device-tags-section', () => ({ DeviceTagsSection: () => null }));

import type { Device } from '../../types/device.types';
import { OverviewTab } from './overview-tab';

const device = { id: 'd-1', machineId: 'machine-1' } as Device;
let container: HTMLDivElement;
let root: Root;

function renderWith(query: string) {
  search = new URLSearchParams(query);
  act(() => {
    root.render(<OverviewTab device={device} />);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockReset();
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  vi.useRealTimers();
});

describe('OverviewTab refresh stamp', () => {
  it('does not reload for a stamp that was already there when the tab mounted', () => {
    renderWith('tab=overview&refresh=100');
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('reloads once for a new stamp while the tab is open', () => {
    renderWith('tab=overview&refresh=100');
    renderWith('tab=overview&refresh=200');
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not reload on Back to the stamp it mounted with', () => {
    renderWith('tab=overview&refresh=100');
    renderWith('tab=overview&refresh=200');
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    renderWith('tab=overview&refresh=100');
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
