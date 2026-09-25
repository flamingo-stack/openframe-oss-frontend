import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { remoteAccessPolicyApiService_device$data as WireDevicePolicy } from '@/__generated__/remoteAccessPolicyApiService_device.graphql';
import type { remoteAccessPolicyApiService_organization$data as WireOrganizationPolicy } from '@/__generated__/remoteAccessPolicyApiService_organization.graphql';
import type { remoteAccessPolicyApiService_tenant$data as WireTenantPolicy } from '@/__generated__/remoteAccessPolicyApiService_tenant.graphql';
import {
  fromWireDevicePolicy,
  fromWireOrganizationPolicy,
  fromWireTenantPolicy,
  RemoteAccessPolicyApiService,
} from './remote-access-policy-api-service';

type MutationConfig = {
  variables: Record<string, unknown>;
  onCompleted: (response: unknown, errors: ReadonlyArray<{ message: string }> | null) => void;
  onError: (error: Error) => void;
};

const relay = vi.hoisted(() => ({
  commitMutation: vi.fn(),
  fetchQuery: vi.fn(),
}));

vi.mock('react-relay', () => ({
  graphql: () => ({}),
  commitMutation: relay.commitMutation,
  fetchQuery: relay.fetchQuery,
}));
vi.mock('@/lib/relay', () => ({ getRelayEnvironment: () => ({}) }));
// `@inline` fragments are read with `readInlineData`; the wire objects below stand in for the ref.
vi.mock('relay-runtime', () => ({ readInlineData: (_fragment: unknown, ref: unknown) => ref }));

const service = new RemoteAccessPolicyApiService();

const wire = <T>(value: Record<string, unknown>): T => value as unknown as T;

/** The next query answers with `data`. */
function queryAnswers(data: unknown) {
  relay.fetchQuery.mockReturnValue({ toPromise: () => Promise.resolve(data) });
}

/** The next mutation completes with `response` and records its variables. */
function mutationAnswers(response: unknown) {
  relay.commitMutation.mockImplementation((_environment: unknown, config: MutationConfig) => {
    config.onCompleted(response, null);
    return { dispose() {} };
  });
}

function lastMutationVariables(): Record<string, unknown> {
  const call = relay.commitMutation.mock.calls.at(-1) as [unknown, MutationConfig] | undefined;
  if (!call) throw new Error('no mutation was committed');
  return call[1].variables;
}

beforeEach(() => {
  relay.commitMutation.mockReset();
  relay.fetchQuery.mockReset();
});

describe('wire -> read models', () => {
  it('reads the tenant, organization and device shapes', () => {
    expect(fromWireTenantPolicy(wire<WireTenantPolicy>({ mode: 'NOTIFY_ONLY' }))).toEqual({ mode: 'NOTIFY_ONLY' });
    expect(
      fromWireOrganizationPolicy(wire<WireOrganizationPolicy>({ mode: null, effectiveMode: 'APPROVAL_REQUIRED' })),
    ).toEqual({ mode: null, effectiveMode: 'APPROVAL_REQUIRED' });
    expect(
      fromWireDevicePolicy(
        wire<WireDevicePolicy>({ mode: 'SILENT_ACCESS', effectiveMode: 'SILENT_ACCESS', effectiveScope: 'DEVICE' }),
      ),
    ).toEqual({ mode: 'SILENT_ACCESS', effectiveMode: 'SILENT_ACCESS', effectiveScope: 'DEVICE' });
  });

  it('rejects a mode or scope the app does not know', () => {
    expect(() => fromWireTenantPolicy(wire<WireTenantPolicy>({ mode: 'ASK_USER' }))).toThrow(/Malformed/);
    expect(() =>
      fromWireDevicePolicy(
        wire<WireDevicePolicy>({ mode: null, effectiveMode: 'NOTIFY_ONLY', effectiveScope: 'GALAXY' }),
      ),
    ).toThrow(/Malformed/);
  });
});

describe('RemoteAccessPolicyApiService', () => {
  it('reads the tenant policy', async () => {
    queryAnswers({ remoteAccessPolicy: { mode: 'DENY_ACCESS' } });
    expect(await service.getTenantPolicy()).toEqual({ mode: 'DENY_ACCESS' });
  });

  it('saves the tenant mode and returns the policy the server kept', async () => {
    mutationAnswers({
      setTenantRemoteAccessMode: { policy: { mode: 'NOTIFY_ONLY' }, userErrors: [] },
    });
    expect(await service.updateTenantPolicy({ mode: 'NOTIFY_ONLY' })).toEqual({ mode: 'NOTIFY_ONLY' });
    expect(lastMutationVariables()).toEqual({ mode: 'NOTIFY_ONLY' });
  });

  it('turns a userError into a rejection with the server message', async () => {
    mutationAnswers({
      setOrganizationRemoteAccessMode: {
        policy: null,
        userErrors: [{ code: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found' }],
      },
    });
    await expect(service.setOrganizationMode('org-1', 'DENY_ACCESS')).rejects.toThrow('Organization not found');
  });

  it('clears an organization override with a null mode', async () => {
    mutationAnswers({
      setOrganizationRemoteAccessMode: {
        policy: { mode: null, effectiveMode: 'APPROVAL_REQUIRED' },
        userErrors: [],
      },
    });
    expect(await service.setOrganizationMode('org-1', null)).toEqual({
      mode: null,
      effectiveMode: 'APPROVAL_REQUIRED',
    });
    expect(lastMutationVariables()).toEqual({ organizationId: 'org-1', mode: null });
  });

  it('reads the device policy off the device and rejects an unknown device', async () => {
    queryAnswers({
      device: { remoteAccess: { mode: null, effectiveMode: 'NOTIFY_ONLY', effectiveScope: 'ORGANIZATION' } },
    });
    expect(await service.getDevicePolicy('machine-1')).toEqual({
      mode: null,
      effectiveMode: 'NOTIFY_ONLY',
      effectiveScope: 'ORGANIZATION',
    });
    queryAnswers({ device: null });
    await expect(service.getDevicePolicy('machine-2')).rejects.toThrow('Device not found');
  });

  it('saves the device mode from the device the mutation returns', async () => {
    mutationAnswers({
      setDeviceRemoteAccessMode: {
        remoteAccess: { mode: 'SILENT_ACCESS', effectiveMode: 'SILENT_ACCESS', effectiveScope: 'DEVICE' },
      },
    });
    expect(await service.setDeviceMode('machine-1', 'SILENT_ACCESS')).toEqual({
      mode: 'SILENT_ACCESS',
      effectiveMode: 'SILENT_ACCESS',
      effectiveScope: 'DEVICE',
    });
    expect(lastMutationVariables()).toEqual({ machineId: 'machine-1', mode: 'SILENT_ACCESS' });
  });
});
