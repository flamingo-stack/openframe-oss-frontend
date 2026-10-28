import type { TagProps } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { isSameDay } from 'date-fns';
import {
  DirectoryReadability,
  OrgUserSource,
  OrgUserStatus,
  OrgUserStatusReason,
  SecondFactorState,
  TopAdminState,
} from '@/generated/schema-enums';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { presentationFor } from '@/lib/exhaustive-map';
import { formatDate } from '@/lib/format-date';
import { type Instant, parseInstant } from '@/lib/graphql-scalars';

type TagVariant = NonNullable<TagProps['variant']>;

const STATUS_TAGS = {
  [OrgUserStatus.ACTIVE]: { label: 'Active', variant: 'success' },
  [OrgUserStatus.PROVISIONED]: { label: 'Provisioned', variant: 'grey' },
  [OrgUserStatus.SUSPENDED]: { label: 'Suspended', variant: 'warning' },
  [OrgUserStatus.DEPROVISIONED]: { label: 'Deprovisioned', variant: 'error' },
} satisfies Record<OrgUserStatus, { label: string; variant: TagVariant }>;

/** The status tag; a status this build does not know yet renders as itself in grey. */
export function userStatusTag(status: string): { label: string; variant: TagVariant } {
  return presentationFor(STATUS_TAGS, status) ?? { label: status, variant: 'grey' };
}

const STATUS_REASONS = {
  [OrgUserStatusReason.SIGN_IN_BLOCKED]: 'Sign-in blocked',
  [OrgUserStatusReason.SUSPENDED_BY_ADMIN]: 'Suspended by an admin',
  [OrgUserStatusReason.SUSPENDED_BY_PROVIDER]: 'Suspended by Google',
  [OrgUserStatusReason.ARCHIVED]: 'Archived',
  [OrgUserStatusReason.DISABLED]: 'Disabled',
  [OrgUserStatusReason.INVITATION_PENDING]: 'Invitation not accepted yet',
  [OrgUserStatusReason.NEVER_SIGNED_IN]: 'Never signed in',
} satisfies Record<OrgUserStatusReason, string>;

/**
 * The status tag's tooltip: what the provider did, then its own words for it (Google's `suspensionReason`), or null
 * when there is nothing to add to the tag.
 */
export function userStatusTooltip(reason: string | null | undefined, detail: string | null | undefined): string | null {
  const parts = [presentationFor(STATUS_REASONS, reason) ?? reason, detail].filter(Boolean);
  return parts.length > 0 ? parts.join(': ') : null;
}

/** Why a last sign-in is empty, when it is not "never" (contract §2). */
function unreadableSignIn(signInData: string): string | null {
  if (signInData === DirectoryReadability.NEEDS_ENTRA_P1) return 'Needs Entra ID P1';
  if (signInData === DirectoryReadability.NOT_CONSENTED) return 'Not permitted';
  return null;
}

/** "5 min" / "3 h" within a day (Figma 733:99047), the calendar date after. */
function relativeSignIn(at: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h`;
  return formatDate(at);
}

/** "Today" on the day itself (Figma 1014:1222), the calendar date otherwise. */
function calendarSignIn(at: Date, now: Date): string {
  return isSameDay(at, now) ? 'Today' : formatDate(at);
}

/**
 * The last sign-in as a row or the user page shows it. Null when the provider holds none: "Needs Entra ID P1" or
 * "Not permitted" when it could not be read, "Never" when it was read and is empty.
 */
export function lastSignInLabel(
  lastSignInAt: Instant | null | undefined,
  signInData: string,
  form: 'relative' | 'calendar',
  now: Date = new Date(),
): string {
  const at = lastSignInAt ? parseInstant(lastSignInAt) : null;
  if (at) return form === 'relative' ? relativeSignIn(at, now) : calendarSignIn(at, now);
  return unreadableSignIn(signInData) ?? 'Never';
}

const TOP_ADMIN_ROLES = {
  [OrgUserSource.MICROSOFT_365]: 'Global admin',
  [OrgUserSource.GOOGLE_WORKSPACE]: 'Super admin',
  [OrgUserSource.OPENFRAME]: null,
} satisfies Record<OrgUserSource, string | null>;

/** The role tag under the name: only the provider's top admin role, named as the provider names it. */
export function topAdminRole(topAdmin: string, source: string): string | null {
  return topAdmin === TopAdminState.YES ? (presentationFor(TOP_ADMIN_ROLES, source) ?? null) : null;
}

/** The user page's "Top admin": No when not held, never "not an admin" — other roles are not read (brief). */
export function topAdminValue(topAdmin: string, source: string): string {
  if (topAdmin === TopAdminState.NOT_READABLE) return 'Not readable';
  return topAdminRole(topAdmin, source) ?? 'No';
}

const SECOND_FACTOR = {
  [SecondFactorState.ENROLLED]: 'Registered',
  [SecondFactorState.NOT_ENROLLED]: 'No second factor registered',
  [SecondFactorState.NOT_READABLE]: 'Not readable',
} satisfies Record<SecondFactorState, string>;

export function secondFactorValue(state: string): string {
  return presentationFor(SECOND_FACTOR, state) ?? state;
}

/** "Name +2": the first of several, counted. The empty mark when there are none. */
export function firstAndCount(names: readonly string[]): { first: string; more: number } {
  return names.length === 0 ? { first: EMPTY_VALUE, more: 0 } : { first: names[0], more: names.length - 1 };
}

/** The claims in the order a cell shows them: the primary customer first when one is chosen, the rest in rule order. */
export function orderClaims<T extends { readonly organization: { readonly organizationId: string } }>(
  claims: readonly T[],
  primaryOrganizationId: string | null | undefined,
): T[] {
  if (!primaryOrganizationId) return [...claims];
  return [...claims].sort(
    (a, b) =>
      Number(b.organization.organizationId === primaryOrganizationId) -
      Number(a.organization.organizationId === primaryOrganizationId),
  );
}
