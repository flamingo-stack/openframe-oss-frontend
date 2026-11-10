import type { TagProps } from '@flamingo-stack/openframe-frontend-core/components/ui';
import {
  EntraJoinType,
  IntuneComplianceState,
  IntuneManagementAgent,
  IntuneOwnerType,
  IntuneUnavailableReason,
} from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';

type TagVariant = TagProps['variant'];

const JOIN_TYPES = {
  [EntraJoinType.ENTRA_JOINED]: 'Entra joined',
  [EntraJoinType.HYBRID_JOINED]: 'Hybrid joined (on-premises AD)',
  [EntraJoinType.REGISTERED]: 'Registered',
} satisfies Record<EntraJoinType, string>;

export function entraJoinTypeLabel(joinType: string): string {
  return presentationFor(JOIN_TYPES, joinType) ?? joinType;
}

const COMPLIANCE = {
  [IntuneComplianceState.COMPLIANT]: { label: 'Compliant', variant: 'success' },
  [IntuneComplianceState.NONCOMPLIANT]: { label: 'Not compliant', variant: 'error' },
  [IntuneComplianceState.IN_GRACE_PERIOD]: { label: 'In grace period', variant: 'warning' },
  [IntuneComplianceState.CONFIG_MANAGER]: { label: 'ConfigMgr', variant: 'grey' },
  [IntuneComplianceState.CONFLICT]: { label: 'Conflict', variant: 'warning' },
  [IntuneComplianceState.ERROR]: { label: 'Error', variant: 'error' },
  [IntuneComplianceState.UNKNOWN]: { label: 'Unknown', variant: 'grey' },
} satisfies Record<IntuneComplianceState, { label: string; variant: TagVariant }>;

export function intuneComplianceTag(state: string): { label: string; variant: TagVariant } {
  return presentationFor(COMPLIANCE, state) ?? { label: state, variant: 'grey' };
}

const OWNERS = {
  [IntuneOwnerType.COMPANY]: 'Company',
  [IntuneOwnerType.PERSONAL]: 'Personal',
  [IntuneOwnerType.UNKNOWN]: 'Unknown',
} satisfies Record<IntuneOwnerType, string>;

export function intuneOwnerLabel(owner: string): string {
  return presentationFor(OWNERS, owner) ?? owner;
}

const MANAGEMENT = {
  [IntuneManagementAgent.MDM]: 'Intune',
  [IntuneManagementAgent.EAS]: 'Exchange ActiveSync',
  [IntuneManagementAgent.EAS_MDM]: 'Intune and Exchange ActiveSync',
  [IntuneManagementAgent.INTUNE_CLIENT]: 'Intune PC client',
  [IntuneManagementAgent.EAS_INTUNE_CLIENT]: 'Intune PC client and Exchange ActiveSync',
  [IntuneManagementAgent.CONFIGURATION_MANAGER]: 'ConfigMgr',
  [IntuneManagementAgent.CONFIGURATION_MANAGER_MDM]: 'Co-managed with ConfigMgr',
  [IntuneManagementAgent.CONFIGURATION_MANAGER_MDM_EAS]: 'Co-managed with ConfigMgr and Exchange ActiveSync',
  [IntuneManagementAgent.JAMF]: 'Jamf',
  [IntuneManagementAgent.GOOGLE_CLOUD_DPC]: 'Google Cloud DPC',
  [IntuneManagementAgent.UNKNOWN]: 'Unknown',
} satisfies Record<IntuneManagementAgent, string>;

export function intuneManagementLabel(agent: string): string {
  return presentationFor(MANAGEMENT, agent) ?? agent;
}

const UNAVAILABLE = {
  [IntuneUnavailableReason.NOT_LICENSED]: {
    title: 'No Intune licence',
    description:
      'This tenant has no Intune licence, so OpenFrame can’t get Intune data. Entra ID is the only Microsoft source for this device.',
  },
  [IntuneUnavailableReason.NOT_CONSENTED]: {
    title: 'No Intune access',
    description:
      'OpenFrame doesn’t have consent to read Intune for this tenant. A tenant admin can grant it in the tenant integration settings.',
  },
  // Licensed and consented, but this device is not in Intune: no design, so no card (contract §2).
  [IntuneUnavailableReason.NOT_ENROLLED]: null,
} satisfies Record<IntuneUnavailableReason, { title: string; description: string } | null>;

/** Why there is no Intune card (Figma 882:63137, 1371:246); null when there is nothing to say. */
export function intuneUnavailableCopy(
  reason: string | null | undefined,
): { title: string; description: string } | null {
  return presentationFor(UNAVAILABLE, reason) ?? null;
}
