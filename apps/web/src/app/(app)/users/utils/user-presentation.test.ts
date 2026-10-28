// Pins what the Users screens render for each contract value (CONTRACT v0.2 §2, §3): every generated enum value has
// an answer, and a value the build does not know degrades to a neutral rendering instead of a crash.

import { describe, expect, it } from 'vitest';
import {
  DirectoryReadability,
  OrgUserSource,
  OrgUserStatus,
  OrgUserStatusReason,
  SecondFactorState,
  TopAdminState,
} from '@/generated/schema-enums';
import { asInstant } from '@/lib/graphql-scalars';
import {
  firstAndCount,
  lastSignInLabel,
  orderClaims,
  secondFactorValue,
  topAdminRole,
  topAdminValue,
  userStatusTag,
  userStatusTooltip,
} from './user-presentation';

const NOW = new Date('2026-10-28T12:00:00Z');

describe('userStatusTag', () => {
  it('labels every status, Active in green', () => {
    for (const status of Object.values(OrgUserStatus)) {
      expect(userStatusTag(status).label).not.toBe('');
    }
    expect(userStatusTag(OrgUserStatus.ACTIVE)).toEqual({ label: 'Active', variant: 'success' });
  });

  it('renders an unknown status as itself in grey', () => {
    expect(userStatusTag('ON_HOLD')).toEqual({ label: 'ON_HOLD', variant: 'grey' });
  });
});

describe('userStatusTooltip', () => {
  it('names every reason, then adds the provider detail', () => {
    for (const reason of Object.values(OrgUserStatusReason)) {
      expect(userStatusTooltip(reason, null)).toBeTruthy();
    }
    expect(userStatusTooltip(OrgUserStatusReason.SUSPENDED_BY_ADMIN, 'ADMIN')).toBe('Suspended by an admin: ADMIN');
  });

  it('is null when there is nothing to add to the tag', () => {
    expect(userStatusTooltip(null, null)).toBeNull();
  });
});

describe('lastSignInLabel', () => {
  it('reads minutes and hours within a day in a row, the date after', () => {
    expect(lastSignInLabel(asInstant('2026-10-28T11:55:00Z'), DirectoryReadability.READ, 'relative', NOW)).toBe(
      '5 min',
    );
    expect(lastSignInLabel(asInstant('2026-10-28T09:00:00Z'), DirectoryReadability.READ, 'relative', NOW)).toBe('3 h');
    expect(lastSignInLabel(asInstant('2026-10-20T09:00:00Z'), DirectoryReadability.READ, 'relative', NOW)).not.toMatch(
      /min|h$/,
    );
  });

  it('reads Today on the user page on the day itself', () => {
    expect(lastSignInLabel(asInstant('2026-10-28T08:00:00Z'), DirectoryReadability.READ, 'calendar', NOW)).toBe(
      'Today',
    );
  });

  it('says why it is empty: unreadable is not never', () => {
    expect(lastSignInLabel(null, DirectoryReadability.NEEDS_ENTRA_P1, 'relative', NOW)).toBe('Needs Entra ID P1');
    expect(lastSignInLabel(null, DirectoryReadability.NOT_CONSENTED, 'relative', NOW)).toBe('Not permitted');
    expect(lastSignInLabel(null, DirectoryReadability.READ, 'calendar', NOW)).toBe('Never');
  });
});

describe('top admin', () => {
  it('names the role as the provider does, and only when held', () => {
    expect(topAdminRole(TopAdminState.YES, OrgUserSource.MICROSOFT_365)).toBe('Global admin');
    expect(topAdminRole(TopAdminState.YES, OrgUserSource.GOOGLE_WORKSPACE)).toBe('Super admin');
    expect(topAdminRole(TopAdminState.NO, OrgUserSource.MICROSOFT_365)).toBeNull();
  });

  it('answers No on the user page, never "not an admin", and says when it could not read', () => {
    expect(topAdminValue(TopAdminState.NO, OrgUserSource.MICROSOFT_365)).toBe('No');
    expect(topAdminValue(TopAdminState.NOT_READABLE, OrgUserSource.MICROSOFT_365)).toBe('Not readable');
  });
});

it('labels every second-factor state', () => {
  for (const state of Object.values(SecondFactorState)) {
    expect(secondFactorValue(state)).not.toBe(state);
  }
});

it('names the first of several and counts the rest', () => {
  expect(firstAndCount([])).toEqual({ first: '—', more: 0 });
  expect(firstAndCount(['a', 'b', 'c'])).toEqual({ first: 'a', more: 2 });
});

describe('orderClaims', () => {
  const claims = [{ organization: { organizationId: 'a' } }, { organization: { organizationId: 'b' } }];

  it('puts the chosen primary customer first and keeps rule order otherwise', () => {
    expect(orderClaims(claims, 'b').map(claim => claim.organization.organizationId)).toEqual(['b', 'a']);
    expect(orderClaims(claims, null).map(claim => claim.organization.organizationId)).toEqual(['a', 'b']);
  });
});
