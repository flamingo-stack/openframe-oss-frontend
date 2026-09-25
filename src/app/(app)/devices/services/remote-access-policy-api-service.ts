import { fetchQuery, graphql } from 'react-relay';
import { readInlineData } from 'relay-runtime';
import type {
  remoteAccessPolicyApiService_device$data as WireDevicePolicy,
  remoteAccessPolicyApiService_device$key as WireDevicePolicyKey,
} from '@/__generated__/remoteAccessPolicyApiService_device.graphql';
import type {
  remoteAccessPolicyApiService_organization$data as WireOrganizationPolicy,
  remoteAccessPolicyApiService_organization$key as WireOrganizationPolicyKey,
} from '@/__generated__/remoteAccessPolicyApiService_organization.graphql';
import type {
  remoteAccessPolicyApiService_tenant$data as WireTenantPolicy,
  remoteAccessPolicyApiService_tenant$key as WireTenantPolicyKey,
} from '@/__generated__/remoteAccessPolicyApiService_tenant.graphql';
import type { remoteAccessPolicyApiServiceDeviceQuery as DeviceQuery } from '@/__generated__/remoteAccessPolicyApiServiceDeviceQuery.graphql';
import type { remoteAccessPolicyApiServiceOrganizationQuery as OrganizationQuery } from '@/__generated__/remoteAccessPolicyApiServiceOrganizationQuery.graphql';
import type { remoteAccessPolicyApiServiceSetDeviceMutation as SetDeviceMutation } from '@/__generated__/remoteAccessPolicyApiServiceSetDeviceMutation.graphql';
import type { remoteAccessPolicyApiServiceSetOrganizationMutation as SetOrganizationMutation } from '@/__generated__/remoteAccessPolicyApiServiceSetOrganizationMutation.graphql';
import type { remoteAccessPolicyApiServiceSetTenantMutation as SetTenantMutation } from '@/__generated__/remoteAccessPolicyApiServiceSetTenantMutation.graphql';
import type { remoteAccessPolicyApiServiceTenantQuery as TenantQuery } from '@/__generated__/remoteAccessPolicyApiServiceTenantQuery.graphql';
import { getRelayEnvironment } from '@/lib/relay';
import { commitMutationPromise } from '@/lib/relay/commit-mutation';
import {
  type DeviceRemoteAccessPolicy,
  type OrganizationRemoteAccessPolicy,
  REMOTE_ACCESS_MODES,
  REMOTE_ACCESS_POLICY_SCOPES,
  type RemoteAccessMode,
  type RemoteAccessPolicyScope,
  type TenantRemoteAccessPolicy,
} from '../types/remote-access';
import type { IRemoteAccessPolicyService } from './remote-access-policy-service';
import { oneOf } from './remote-access-wire';

/**
 * The remote access policy on openframe-saas-api, GraphQL like the approval
 * and session clients. Tenant and organization scopes have their own
 * operations; the device scope is a field on `Machine`, resolved on the server
 * (device -> organization -> tenant -> defaults), read here through its own
 * small query so the shared device queries stay untouched until the field
 * exists on every environment.
 */

const tenantFragment = graphql`
  fragment remoteAccessPolicyApiService_tenant on TenantRemoteAccessPolicy @inline {
    mode
  }
`;

const organizationFragment = graphql`
  fragment remoteAccessPolicyApiService_organization on OrganizationRemoteAccessPolicy @inline {
    mode
    effectiveMode
  }
`;

const deviceFragment = graphql`
  fragment remoteAccessPolicyApiService_device on DeviceRemoteAccess @inline {
    mode
    effectiveMode
    effectiveScope
  }
`;

const tenantQuery = graphql`
  query remoteAccessPolicyApiServiceTenantQuery {
    remoteAccessPolicy {
      ...remoteAccessPolicyApiService_tenant
    }
  }
`;

const organizationQuery = graphql`
  query remoteAccessPolicyApiServiceOrganizationQuery($organizationId: String!) {
    organizationRemoteAccessPolicy(organizationId: $organizationId) {
      ...remoteAccessPolicyApiService_organization
    }
  }
`;

const deviceQuery = graphql`
  query remoteAccessPolicyApiServiceDeviceQuery($machineId: String!) {
    device(machineId: $machineId) {
      remoteAccess {
        ...remoteAccessPolicyApiService_device
      }
    }
  }
`;

const setTenantMutation = graphql`
  mutation remoteAccessPolicyApiServiceSetTenantMutation($mode: RemoteAccessMode!) {
    setTenantRemoteAccessMode(mode: $mode) {
      policy {
        ...remoteAccessPolicyApiService_tenant
      }
      userErrors {
        code
        message
      }
    }
  }
`;

const setOrganizationMutation = graphql`
  mutation remoteAccessPolicyApiServiceSetOrganizationMutation($organizationId: String!, $mode: RemoteAccessMode) {
    setOrganizationRemoteAccessMode(organizationId: $organizationId, mode: $mode) {
      policy {
        ...remoteAccessPolicyApiService_organization
      }
      userErrors {
        code
        message
      }
    }
  }
`;

const setDeviceMutation = graphql`
  mutation remoteAccessPolicyApiServiceSetDeviceMutation($machineId: String!, $mode: RemoteAccessMode) {
    setDeviceRemoteAccessMode(machineId: $machineId, mode: $mode) {
      remoteAccess {
        ...remoteAccessPolicyApiService_device
      }
    }
  }
`;

const MODES: ReadonlySet<string> = new Set(REMOTE_ACCESS_MODES);
const SCOPES: ReadonlySet<string> = new Set(REMOTE_ACCESS_POLICY_SCOPES);

function requiredMode(value: unknown): RemoteAccessMode {
  const mode = oneOf<RemoteAccessMode>(value, MODES);
  if (!mode) throw new Error('Malformed remote access policy from the server');
  return mode;
}

function optionalMode(value: unknown): RemoteAccessMode | null {
  return value === null || value === undefined ? null : requiredMode(value);
}

/** The wire shapes (the fragments' data) -> the app's read models. Throw on a body without a valid mode. */
export function fromWireTenantPolicy(data: WireTenantPolicy): TenantRemoteAccessPolicy {
  return { mode: requiredMode(data.mode) };
}

export function fromWireOrganizationPolicy(data: WireOrganizationPolicy): OrganizationRemoteAccessPolicy {
  return { mode: optionalMode(data.mode), effectiveMode: requiredMode(data.effectiveMode) };
}

export function fromWireDevicePolicy(data: WireDevicePolicy): DeviceRemoteAccessPolicy {
  const effectiveScope = oneOf<RemoteAccessPolicyScope>(data.effectiveScope, SCOPES);
  if (!effectiveScope) throw new Error('Malformed remote access policy from the server');
  return { mode: optionalMode(data.mode), effectiveMode: requiredMode(data.effectiveMode), effectiveScope };
}

function readTenant(ref: WireTenantPolicyKey): TenantRemoteAccessPolicy {
  return fromWireTenantPolicy(readInlineData(tenantFragment, ref));
}

function readOrganization(ref: WireOrganizationPolicyKey): OrganizationRemoteAccessPolicy {
  return fromWireOrganizationPolicy(readInlineData(organizationFragment, ref));
}

function readDevice(ref: WireDevicePolicyKey): DeviceRemoteAccessPolicy {
  return fromWireDevicePolicy(readInlineData(deviceFragment, ref));
}

interface UserErrorLike {
  readonly code: string;
  readonly message: string;
}

/** A refusal in `userErrors`: the server's message, or the caller's fallback. */
function refusal(errors: ReadonlyArray<UserErrorLike>, fallback: string): Error {
  return new Error(errors[0]?.message || fallback);
}

export class RemoteAccessPolicyApiService implements IRemoteAccessPolicyService {
  async getTenantPolicy(): Promise<TenantRemoteAccessPolicy> {
    const data = await fetchQuery<TenantQuery>(
      getRelayEnvironment(),
      tenantQuery,
      {},
      { fetchPolicy: 'network-only' },
    ).toPromise();
    if (!data?.remoteAccessPolicy) throw new Error('Remote access policy unavailable');
    return readTenant(data.remoteAccessPolicy);
  }

  async updateTenantPolicy(policy: TenantRemoteAccessPolicy): Promise<TenantRemoteAccessPolicy> {
    const payload = await commitMutationPromise<SetTenantMutation>(setTenantMutation, { mode: policy.mode });
    const { policy: saved, userErrors } = payload.setTenantRemoteAccessMode;
    if (userErrors.length > 0 || !saved) throw refusal(userErrors, 'Could not save the remote access permission');
    return readTenant(saved);
  }

  async getOrganizationPolicy(organizationId: string): Promise<OrganizationRemoteAccessPolicy> {
    const data = await fetchQuery<OrganizationQuery>(
      getRelayEnvironment(),
      organizationQuery,
      { organizationId },
      { fetchPolicy: 'network-only' },
    ).toPromise();
    if (!data?.organizationRemoteAccessPolicy) throw new Error('Remote access policy unavailable');
    return readOrganization(data.organizationRemoteAccessPolicy);
  }

  async setOrganizationMode(
    organizationId: string,
    mode: RemoteAccessMode | null,
  ): Promise<OrganizationRemoteAccessPolicy> {
    const payload = await commitMutationPromise<SetOrganizationMutation>(setOrganizationMutation, {
      organizationId,
      mode,
    });
    const { policy: saved, userErrors } = payload.setOrganizationRemoteAccessMode;
    if (userErrors.length > 0 || !saved) throw refusal(userErrors, 'Could not save the remote access permission');
    return readOrganization(saved);
  }

  /** The server resolves the scopes itself; the organization id the mock needs is not used here. */
  async getDevicePolicy(deviceId: string): Promise<DeviceRemoteAccessPolicy> {
    const data = await fetchQuery<DeviceQuery>(
      getRelayEnvironment(),
      deviceQuery,
      { machineId: deviceId },
      { fetchPolicy: 'network-only' },
    ).toPromise();
    if (!data?.device) throw new Error('Device not found');
    return readDevice(data.device.remoteAccess);
  }

  /** Refusals (unknown device, feature off) arrive as GraphQL errors and reject through the promise. */
  async setDeviceMode(deviceId: string, mode: RemoteAccessMode | null): Promise<DeviceRemoteAccessPolicy> {
    const payload = await commitMutationPromise<SetDeviceMutation>(setDeviceMutation, { machineId: deviceId, mode });
    return readDevice(payload.setDeviceRemoteAccessMode.remoteAccess);
  }
}

export const remoteAccessPolicyApiService = new RemoteAccessPolicyApiService();
