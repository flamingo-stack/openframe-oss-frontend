/**
 * `fetchDeviceUnsupportedTools` must never break the device page: a backend that predates
 * `Machine.unsupportedTools` refuses the query, and that reads as "nothing unsupported".
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDeviceUnsupportedTools } from './device-unsupported-tools';

const relay = vi.hoisted(() => ({ fetchQuery: vi.fn() }));

// Vitest runs no Relay babel transform, so the graphql tag is stubbed; the query document is not under test.
vi.mock('react-relay', () => ({ graphql: () => ({}) }));
vi.mock('relay-runtime', () => ({ fetchQuery: relay.fetchQuery }));
vi.mock('@/lib/relay/environment', () => ({ getRelayEnvironment: () => ({}) }));

/** The query answers with this result (a resolved payload or a refusal). */
function answers(result: Promise<unknown>) {
  relay.fetchQuery.mockReturnValue({ toPromise: () => result });
}

describe('fetchDeviceUnsupportedTools', () => {
  beforeEach(() => relay.fetchQuery.mockReset());

  it('returns the reported entries, asked network-only for this machine', async () => {
    const entry = { toolType: 'FLEET_MDM', minOsVersion: '13.0', osVersion: '11.7.10' };
    answers(Promise.resolve({ device: { unsupportedTools: [entry] } }));

    await expect(fetchDeviceUnsupportedTools('machine-1')).resolves.toEqual([entry]);
    expect(relay.fetchQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { machineId: 'machine-1' },
      { fetchPolicy: 'network-only' },
    );
  });

  it('reads a refused query (a backend without the field) as none', async () => {
    answers(Promise.reject(new Error("Validation error: Field 'unsupportedTools' in type 'Machine' is undefined")));

    await expect(fetchDeviceUnsupportedTools('machine-1')).resolves.toEqual([]);
  });

  it('reads a missing device as none', async () => {
    answers(Promise.resolve({ device: null }));

    await expect(fetchDeviceUnsupportedTools('machine-1')).resolves.toEqual([]);
  });
});
