/**
 * Pins how a device table's rows learn their remote access policy: the table
 * reads a page of rows in one call, files each answer under the device's own
 * key, and a row menu watches that key without reading on its own. Nothing is
 * read while the feature is off.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeviceRemoteAccessPolicy } from '../types/remote-access';
import { useEffectiveDeviceRemoteAccessMode, useRowRemoteAccessPolicies } from './use-remote-access-policy';

const { gate, service } = vi.hoisted(() => ({
  gate: { value: 'on' as 'on' | 'off' | 'loading' },
  service: { getDevicePolicies: vi.fn(), getDevicePolicy: vi.fn() },
}));

vi.mock('./use-remote-access-approval-gate', () => ({
  useRemoteAccessApprovalGate: () => gate.value,
}));

// The real module carries the list's graphql tags, which need the Relay babel plugin vitest does not run.
vi.mock('../queries/devices-api', () => ({ DEVICES_PAGE_SIZE: 20 }));

vi.mock('./use-remote-access-policy-service', () => ({
  useRemoteAccessPolicyService: () => ({ service, isMock: false, ready: true }),
}));

const DENIED: DeviceRemoteAccessPolicy = {
  mode: 'DENY_ACCESS',
  effectiveMode: 'DENY_ACCESS',
  effectiveScope: 'DEVICE',
};

const devices = Array.from({ length: 25 }, (_, i) => ({ id: `node-${i}`, machineId: `machine-${i}` }));
// A row without a machine id is not something the read can address.
const tableRows = [...devices, { id: 'node-orphan', machineId: '' }];

function Row({ machineId }: { machineId: string }) {
  const mode = useEffectiveDeviceRemoteAccessMode({ id: machineId, machineId }, { context: 'row' });
  return <span data-machine={machineId} data-mode={mode ?? ''} />;
}

function Table() {
  useRowRemoteAccessPolicies(tableRows);
  return (
    <>
      {devices.map(device => (
        <Row key={device.machineId} machineId={device.machineId} />
      ))}
    </>
  );
}

let root: Root;
let container: HTMLDivElement;

/** What the row menu of `machineId` sees; '' when it has no mode. */
const modeOf = (machineId: string) =>
  container.querySelector(`[data-machine="${machineId}"]`)?.getAttribute('data-mode');

async function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Table />
      </QueryClientProvider>,
    );
  });
  // Let the page reads resolve and the rows re-render from the seeded cache.
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
  gate.value = 'on';
  service.getDevicePolicy.mockReset();
  service.getDevicePolicies.mockReset();
  service.getDevicePolicies.mockImplementation(async (page: ReadonlyArray<{ deviceId: string }>) => {
    return new Map(page.filter(ref => ref.deviceId === 'machine-21').map(ref => [ref.deviceId, DENIED]));
  });
});

afterEach(() => {
  act(() => root.unmount());
});

describe('useRowRemoteAccessPolicies', () => {
  it('reads the rows a page at a time and the row menus pick the answer up', async () => {
    await render();

    const pages = service.getDevicePolicies.mock.calls.map(([page]) =>
      (page as ReadonlyArray<{ deviceId: string }>).map(ref => ref.deviceId),
    );
    expect(pages.map(page => page.length)).toEqual([20, 5]);
    expect(pages[1]?.[0]).toBe('machine-20');
    expect(modeOf('machine-21')).toBe('DENY_ACCESS');
    expect(modeOf('machine-0')).toBe('');
    expect(service.getDevicePolicy).not.toHaveBeenCalled();
  });

  it('reads nothing while the feature is off', async () => {
    gate.value = 'off';
    await render();

    expect(service.getDevicePolicies).not.toHaveBeenCalled();
    expect(modeOf('machine-0')).toBe('');
    expect(modeOf('machine-21')).toBe('');
  });
});
