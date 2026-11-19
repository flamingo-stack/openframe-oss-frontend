/**
 * The first device's enrollment as the checklist reads it: the registration
 * stamp and the connected stage come through, and a read that comes back
 * without an enrollment (a transient error, per the schema) does not take the
 * stages back - the stamps are never cleared.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Enrollment = {
  registeredAt: string;
  connectedAt: string | null;
  inventoryConnectedAt: string | null;
  ready: boolean;
} | null;

const relay = vi.hoisted(() => ({ machineId: 'm-1', enrollment: null as Enrollment }));

vi.mock('react-relay', () => ({
  useRelayEnvironment: () => ({}),
  useLazyLoadQuery: () => ({
    devices: {
      edges: [
        {
          node: {
            id: 'TWFjaGluZTptLTE=',
            machineId: relay.machineId,
            hostname: 'mac',
            displayName: null,
            status: 'ACTIVE',
            connectivity: null,
            enrollment: relay.enrollment,
          },
        },
      ],
    },
  }),
  fetchQuery: () => ({ subscribe: () => ({ unsubscribe: () => undefined }), toPromise: () => Promise.resolve(null) }),
  graphql: () => null,
}));
vi.mock('@/graphql/onboarding/first-device-enrollment-relay', () => ({ firstDeviceEnrollmentRelayQuery: {} }));
vi.mock('@/graphql/devices/to-relay-device-filter', () => ({ toRelayDeviceFilter: () => ({}) }));

import { type FirstDevice, useFirstDeviceEnrollment } from './use-first-device-enrollment';

let container: HTMLDivElement;
let root: Root;
/** What the hook returned on the last render, read back from the page. */
let seen: FirstDevice | null = null;

function Probe() {
  return <output>{JSON.stringify(useFirstDeviceEnrollment(false))}</output>;
}

const read = () => {
  act(() => root.render(<Probe />));
  seen = JSON.parse(container.textContent || 'null') as FirstDevice | null;
};

beforeEach(() => {
  container = document.createElement('div');
  root = createRoot(container);
  relay.machineId = 'm-1';
  relay.enrollment = null;
  seen = null;
});

afterEach(() => {
  act(() => root.unmount());
});

const REGISTERED = '2026-11-18T10:00:00Z';

describe('useFirstDeviceEnrollment', () => {
  it('reads the registration stamp and the connected stage', () => {
    relay.enrollment = { registeredAt: REGISTERED, connectedAt: null, inventoryConnectedAt: null, ready: false };
    read();
    expect(seen?.registeredAt).toBe(Date.parse(REGISTERED));
    expect(seen?.stages.connected).toBe(false);

    relay.enrollment = { registeredAt: REGISTERED, connectedAt: REGISTERED, inventoryConnectedAt: null, ready: false };
    read();
    expect(seen?.stages.connected).toBe(true);
    expect(seen?.stages.aiReady).toBe(false);
  });

  it('keeps the last good stages through a read without an enrollment', () => {
    relay.enrollment = {
      registeredAt: REGISTERED,
      connectedAt: REGISTERED,
      inventoryConnectedAt: REGISTERED,
      ready: true,
    };
    read();
    expect(seen?.stages.aiReady).toBe(true);

    relay.enrollment = null;
    read();
    expect(seen?.stages).toMatchObject({ connected: true, inventoryReceived: true, aiReady: true });
    expect(seen?.registeredAt).toBe(Date.parse(REGISTERED));
  });

  it('does not lend one machine the stages of another', () => {
    relay.enrollment = {
      registeredAt: REGISTERED,
      connectedAt: REGISTERED,
      inventoryConnectedAt: REGISTERED,
      ready: true,
    };
    read();

    relay.machineId = 'm-2';
    relay.enrollment = null;
    read();
    expect(seen?.machineId).toBe('m-2');
    expect(seen?.stages.connected).toBe(false);
    expect(seen?.registeredAt).toBeNull();
  });
});
