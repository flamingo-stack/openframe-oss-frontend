import {
  DirectoryGroupKind,
  DirectoryProvider,
  DirectoryGroupVisibility,
  DirectoryMembershipScope,
  DirectoryReadOnlyReason,
} from '@/generated/schema-enums';
import { presentationFor } from '@/lib/exhaustive-map';

const GROUP_KINDS = {
  [DirectoryGroupKind.MICROSOFT_365]: { type: 'Microsoft 365', member: 'Microsoft 365 group' },
  [DirectoryGroupKind.SECURITY]: { type: 'Security', member: 'Security group' },
  [DirectoryGroupKind.MAIL_ENABLED_SECURITY]: { type: 'Mail-enabled security', member: 'Mail-enabled security group' },
  [DirectoryGroupKind.DISTRIBUTION]: { type: 'Distribution', member: 'Distribution list' },
  [DirectoryGroupKind.GOOGLE_GROUP]: { type: 'Google Group', member: 'Google Group' },
} satisfies Record<DirectoryGroupKind, { type: string; member: string }>;

/** The group page's Type (Figma 733:99325). */
export function groupTypeLabel(kind: string): string {
  return presentationFor(GROUP_KINDS, kind)?.type ?? kind;
}

/** A subgroup's line among a group's members: "Security group, nested" (Figma 733:99325). */
export function nestedGroupLabel(kind: string): string {
  return `${presentationFor(GROUP_KINDS, kind)?.member ?? kind}, nested`;
}

const GROUP_VISIBILITIES = {
  [DirectoryGroupVisibility.PUBLIC]: 'Public',
  [DirectoryGroupVisibility.PRIVATE]: 'Private',
  [DirectoryGroupVisibility.HIDDEN_MEMBERSHIP]: 'Hidden membership',
} satisfies Record<DirectoryGroupVisibility, string>;

export function groupVisibilityLabel(visibility: string): string {
  return presentationFor(GROUP_VISIBILITIES, visibility) ?? visibility;
}

/** "Dynamic · processing On" (Figma 733:99325); null when the provider has no such setting (Google). */
export function groupMembershipLabel(settings: {
  readonly dynamic?: boolean | null;
  readonly membershipPaused?: boolean | null;
}): string | null {
  if (settings.dynamic == null) return null;
  if (!settings.dynamic) return 'Assigned';
  return `Dynamic · processing ${settings.membershipPaused ? 'Paused' : 'On'}`;
}

const READ_ONLY_REASONS = {
  [DirectoryReadOnlyReason.WRITE_NOT_ENABLED]: 'Writes are not enabled for this connection',
  [DirectoryReadOnlyReason.WRITE_NOT_CONSENTED]: 'The customer has not consented to writes',
  [DirectoryReadOnlyReason.PAUSED]: 'The sync is paused',
  [DirectoryReadOnlyReason.DISCONNECTED]: 'The connection is disconnected',
  [DirectoryReadOnlyReason.MASTERED_ON_PREMISES]: 'Managed in on-premises Active Directory',
  [DirectoryReadOnlyReason.DEPROVISIONED]: 'Deprovisioned in the directory',
  [DirectoryReadOnlyReason.DYNAMIC_MEMBERSHIP]: 'Its membership is dynamic',
  [DirectoryReadOnlyReason.EXCHANGE_MANAGED]: 'Managed in Exchange',
} satisfies Record<DirectoryReadOnlyReason, string>;

/** Why a record cannot be changed: the first reason says it (contract §4); a group with none is read-only regardless. */
export function readOnlyTooltip(reasons: readonly string[]): string {
  const [first] = reasons;
  if (first === undefined) return 'OpenFrame reads this group and does not change it';
  return presentationFor(READ_ONLY_REASONS, first) ?? first;
}

/**
 * The Membership funnel is checkboxes (Figma 1052:38270) over one server value, so the last tick wins: ticking the other
 * scope switches to it, and clearing the funnel goes back to direct members.
 */
export function pickMembershipScope(current: string, ticked: readonly string[]): string {
  if (ticked.length === 1 && ticked[0] === current) return current;
  return ticked.find(value => value !== current) ?? DirectoryMembershipScope.DIRECT;
}

/** The hint on a group's external member count: what its provider's directory does not hold. */
export function externalMembersHint(provider: string): string {
  const directory =
    provider === DirectoryProvider.MICROSOFT_365 ? 'this Microsoft 365 tenant' : 'this Google Workspace';
  return `Not a user, group or device of ${directory} — e.g. an outside email address or a contact.`;
}

/**
 * The members table with no row to draw. A group whose members are all outside this customer or outside the
 * directory has members, only none the table lists: the counts beside it say where they are.
 */
export function membersEmptyMessage({
  liveFailed,
  hiddenCount,
  externalCount,
}: {
  liveFailed: boolean;
  hiddenCount: number;
  externalCount: number;
}): string {
  if (liveFailed) return 'The nested members could not be read just now. Try again in a few minutes.';
  return hiddenCount > 0 || externalCount > 0 ? 'No members to list here.' : 'This group has no members.';
}
