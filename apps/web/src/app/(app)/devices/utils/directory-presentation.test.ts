import { describe, expect, it } from 'vitest';
import {
  EntraJoinType,
  IntuneComplianceState,
  IntuneManagementAgent,
  IntuneOwnerType,
  IntuneUnavailableReason,
} from '@/generated/schema-enums';
import {
  entraJoinTypeLabel,
  intuneComplianceTag,
  intuneManagementLabel,
  intuneOwnerLabel,
  intuneUnavailableCopy,
} from './directory-presentation';

describe('labels', () => {
  it('names every value of the enums', () => {
    for (const value of Object.values(EntraJoinType)) expect(entraJoinTypeLabel(value)).not.toBe(value);
    for (const value of Object.values(IntuneOwnerType)) expect(intuneOwnerLabel(value)).not.toBe(value);
    for (const value of Object.values(IntuneManagementAgent)) expect(intuneManagementLabel(value)).not.toBe(value);
    for (const value of Object.values(IntuneComplianceState)) expect(intuneComplianceTag(value).label).not.toBe(value);
  });

  it("uses Figma's words where it has them", () => {
    expect(entraJoinTypeLabel(EntraJoinType.HYBRID_JOINED)).toBe('Hybrid joined (on-premises AD)');
    expect(intuneManagementLabel(IntuneManagementAgent.CONFIGURATION_MANAGER_MDM)).toBe('Co-managed with ConfigMgr');
    expect(intuneComplianceTag(IntuneComplianceState.COMPLIANT)).toEqual({ label: 'Compliant', variant: 'success' });
  });

  it('keeps a value this build does not know', () => {
    expect(entraJoinTypeLabel('NEW')).toBe('NEW');
    expect(intuneComplianceTag('NEW')).toEqual({ label: 'NEW', variant: 'grey' });
  });
});

describe('intuneUnavailableCopy', () => {
  it('explains a missing licence and missing consent', () => {
    expect(intuneUnavailableCopy(IntuneUnavailableReason.NOT_LICENSED)?.title).toBe('No Intune licence');
    expect(intuneUnavailableCopy(IntuneUnavailableReason.NOT_CONSENTED)?.title).toBe('No Intune access');
  });

  it('has nothing to say for a device simply not in Intune, or no reason', () => {
    expect(intuneUnavailableCopy(IntuneUnavailableReason.NOT_ENROLLED)).toBeNull();
    expect(intuneUnavailableCopy(null)).toBeNull();
  });
});
