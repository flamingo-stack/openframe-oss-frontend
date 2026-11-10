import { describe, expect, it } from 'vitest';
import {
  DirectoryGroupKind,
  DirectoryGroupVisibility,
  DirectoryMembershipScope,
  DirectoryReadOnlyReason,
} from '@/generated/schema-enums';
import {
  externalMembersHint,
  groupMembershipLabel,
  groupTypeLabel,
  groupVisibilityLabel,
  membersEmptyMessage,
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

  it('names every visibility', () => {
    for (const visibility of Object.values(DirectoryGroupVisibility)) {
      expect(groupVisibilityLabel(visibility)).not.toBe(visibility);
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

  it('says where a group with no reason is managed: OpenFrame never changes a group', () => {
    expect(readOnlyTooltip([])).toBe('Managed in the directory: OpenFrame does not change groups');
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

describe('external members', () => {
  it("names the provider's directory the members are outside of", () => {
    expect(externalMembersHint('GOOGLE_WORKSPACE')).toBe(
      'Not a user, group or device of this Google Workspace — e.g. an outside email address or a contact.',
    );
    expect(externalMembersHint('MICROSOFT_365')).toBe(
      'Not a user, group or device of this Microsoft 365 tenant — e.g. an outside email address or a contact.',
    );
  });
});

describe('membersEmptyMessage', () => {
  it('says a group with no member at all has none', () => {
    expect(membersEmptyMessage({ liveFailed: false, hiddenCount: 0, externalCount: 0 })).toBe(
      'This group has no members.',
    );
  });

  it('never says "no members" of a group whose members are all external or outside this customer', () => {
    expect(membersEmptyMessage({ liveFailed: false, hiddenCount: 0, externalCount: 1 })).toBe(
      'No members to list here.',
    );
    expect(membersEmptyMessage({ liveFailed: false, hiddenCount: 2, externalCount: 0 })).toBe(
      'No members to list here.',
    );
  });

  it('says a failed nested read failed, whatever the counts', () => {
    expect(membersEmptyMessage({ liveFailed: true, hiddenCount: 0, externalCount: 3 })).toMatch(/could not be read/);
  });
});
