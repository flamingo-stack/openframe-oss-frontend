import { describe, expect, it } from 'vitest';
import {
  DirectoryGroupKind,
  DirectoryGroupVisibility,
  DirectoryMembershipScope,
  DirectoryReadOnlyReason,
  OrgDeviceKind,
} from '@/generated/schema-enums';
import {
  groupMembershipLabel,
  groupTypeLabel,
  groupVisibilityLabel,
  memberDeviceLabel,
  nestedGroupLabel,
  pickMembershipScope,
  readOnlyTooltip,
} from './group-presentation';

const { DIRECT, NESTED } = DirectoryMembershipScope;

describe('group labels', () => {
  it('names every kind, and keeps one this build does not know', () => {
    for (const kind of Object.values(DirectoryGroupKind)) {
      expect(groupTypeLabel(kind)).not.toBe(kind);
      expect(nestedGroupLabel(kind)).toMatch(/, nested$/);
    }
    expect(groupTypeLabel('NEW_KIND')).toBe('NEW_KIND');
    expect(nestedGroupLabel(DirectoryGroupKind.SECURITY)).toBe('Security group, nested');
  });

  it('names every visibility and device kind', () => {
    for (const visibility of Object.values(DirectoryGroupVisibility)) {
      expect(groupVisibilityLabel(visibility)).not.toBe(visibility);
    }
    for (const kind of Object.values(OrgDeviceKind)) {
      expect(memberDeviceLabel(kind)).toMatch(/device$/);
    }
  });
});

describe('groupMembershipLabel', () => {
  it('says how a Microsoft group fills, and nothing for a provider without the setting', () => {
    expect(groupMembershipLabel({ dynamic: true, membershipPaused: false })).toBe('Dynamic · processing On');
    expect(groupMembershipLabel({ dynamic: true, membershipPaused: true })).toBe('Dynamic · processing Paused');
    expect(groupMembershipLabel({ dynamic: false, membershipPaused: null })).toBe('Assigned');
    expect(groupMembershipLabel({ dynamic: null })).toBeNull();
  });
});

describe('readOnlyTooltip', () => {
  it('gives the first reason, one for every value', () => {
    for (const reason of Object.values(DirectoryReadOnlyReason)) {
      expect(readOnlyTooltip([reason])).not.toBe(reason);
    }
    expect(readOnlyTooltip([DirectoryReadOnlyReason.PAUSED, DirectoryReadOnlyReason.DISCONNECTED])).toBe(
      'The sync is paused',
    );
  });

  it('still explains a group with no reason', () => {
    expect(readOnlyTooltip([])).toBe('OpenFrame reads this group and does not change it');
  });
});

describe('pickMembershipScope', () => {
  it('switches to the other scope when it is ticked', () => {
    expect(pickMembershipScope(DIRECT, [NESTED])).toBe(NESTED);
    expect(pickMembershipScope(DIRECT, [DIRECT, NESTED])).toBe(NESTED);
    expect(pickMembershipScope(NESTED, [NESTED, DIRECT])).toBe(DIRECT);
  });

  it('keeps the scope when nothing moved, and clearing means direct', () => {
    expect(pickMembershipScope(NESTED, [NESTED])).toBe(NESTED);
    expect(pickMembershipScope(DIRECT, [DIRECT])).toBe(DIRECT);
    expect(pickMembershipScope(NESTED, [])).toBe(DIRECT);
  });
});
