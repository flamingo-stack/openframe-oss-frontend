// Pins the enum → label/variant/copy decisions the screens render from: every generated
// enum value has a non-empty answer, and an unknown value (a backend ahead of the SDL)
// degrades to a neutral rendering instead of a crash.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DirectoryAccessState,
  DirectoryCapability,
  DirectoryConsentIssueKind,
  DirectoryConsentOutcome,
  DirectoryProvider,
} from '@/generated/schema-enums';
import { EMPTY_VALUE } from '@/lib/empty-value';
import { formatDate } from '@/lib/format-date';
import {
  accessStateHint,
  accessStateTag,
  capabilityLabels,
  checkResultTag,
  consentAlert,
  consentIssueCode,
  consentIssueReport,
  consentIssueTag,
  formatConnectedAt,
  formatLastRead,
  isReadable,
  lastReadAt,
  PROVIDER_ORDER,
  providerErrorLookupUrl,
  providerPresentation,
  usersCountLabel,
} from './tenant-presentation';

const access = (state: DirectoryAccessState) => ({ state });

describe('accessStateTag', () => {
  it('gives every access state a label and a variant', () => {
    for (const state of Object.values(DirectoryAccessState)) {
      const tag = accessStateTag(state);
      expect(tag.label, state).not.toBe('');
      expect(tag.variant, state).toBeTruthy();
    }
  });

  it('uses the colours of the Figma list', () => {
    expect(accessStateTag(DirectoryAccessState.DISCONNECTED).variant).toBe('error');
    expect(accessStateTag(DirectoryAccessState.CONSENT_REVOKED).variant).toBe('error');
    expect(accessStateTag(DirectoryAccessState.READ_ONLY).variant).toBe('grey');
    expect(accessStateTag(DirectoryAccessState.WRITE_AVAILABLE).variant).toBe('outline');
    expect(accessStateTag(DirectoryAccessState.WRITE_ENABLED).variant).toBe('success');
  });

  it('renders NOT_AUTHORISED as an error tag (no Figma frame)', () => {
    expect(accessStateTag(DirectoryAccessState.NOT_AUTHORISED)).toEqual({ label: 'Not authorised', variant: 'error' });
  });

  it('degrades an unknown value to its raw name in grey, and nothing to the empty mark', () => {
    expect(accessStateTag('SOMETHING_NEW')).toEqual({ label: 'SOMETHING_NEW', variant: 'grey' });
    expect(accessStateTag(null)).toEqual({ label: EMPTY_VALUE, variant: 'grey' });
    expect(accessStateTag(undefined)).toEqual({ label: EMPTY_VALUE, variant: 'grey' });
  });
});

describe('isReadable / checkResultTag', () => {
  it('treats the three states above DISCONNECTED as a live read', () => {
    expect(isReadable(DirectoryAccessState.READ_ONLY)).toBe(true);
    expect(isReadable(DirectoryAccessState.WRITE_AVAILABLE)).toBe(true);
    expect(isReadable(DirectoryAccessState.WRITE_ENABLED)).toBe(true);
    expect(isReadable(DirectoryAccessState.DISCONNECTED)).toBe(false);
    expect(isReadable(DirectoryAccessState.NOT_AUTHORISED)).toBe(false);
    expect(isReadable(DirectoryAccessState.CONSENT_REVOKED)).toBe(false);
    expect(isReadable(null)).toBe(false);
  });

  it('shows "Connected and readable" after a successful probe and the access tag otherwise', () => {
    expect(checkResultTag(access(DirectoryAccessState.READ_ONLY))).toEqual({
      label: 'Connected and readable',
      variant: 'success',
    });
    expect(checkResultTag(access(DirectoryAccessState.CONSENT_REVOKED))).toEqual(
      accessStateTag(DirectoryAccessState.CONSENT_REVOKED),
    );
  });
});

describe('accessStateHint', () => {
  it('tells who has to act for every state that did not read the directory', () => {
    for (const state of Object.values(DirectoryAccessState).filter(value => !isReadable(value))) {
      expect(accessStateHint(state), state).not.toBe(accessStateTag(state).label);
      expect(accessStateHint(state), state).toMatch(/admin/);
    }
  });

  it('falls back to the tag label for a state this build does not know', () => {
    expect(accessStateHint('SUSPENDED')).toBe('SUSPENDED');
  });
});

describe('providerPresentation', () => {
  it('names both providers, with a logo and the consent copy the screens print', () => {
    for (const provider of Object.values(DirectoryProvider)) {
      const meta = providerPresentation(provider);
      expect(meta.label, provider).not.toBe('');
      expect(meta.Logo, provider).toBeTypeOf('function');
      expect(meta.radioDescription, provider).not.toBe('');
      expect(meta.consentInstruction, provider).not.toBe('');
      expect(meta.reapproveInstruction, provider).not.toBe('');
    }
    expect(providerPresentation(DirectoryProvider.MICROSOFT_365).label).toBe('Microsoft 365');
    expect(providerPresentation(DirectoryProvider.GOOGLE_WORKSPACE).label).toBe('Google Workspace');
  });

  it('keeps the raw name of an unknown provider and lists Microsoft first', () => {
    expect(providerPresentation('OKTA').label).toBe('OKTA');
    expect(providerPresentation(null).label).toBe('Unknown provider');
    expect(PROVIDER_ORDER[0]).toBe(DirectoryProvider.MICROSOFT_365);
  });
});

describe('capabilityLabels', () => {
  it('labels every capability and keeps unknown ones verbatim', () => {
    const labels = capabilityLabels(Object.values(DirectoryCapability));
    expect(labels).toEqual([
      'Users',
      'Groups',
      'Org units',
      'Licences',
      'Devices',
      'Audit logs',
      'OAuth apps',
      'Admin roles',
    ]);
    expect(capabilityLabels(['MAILBOXES'])).toEqual(['MAILBOXES']);
  });
});

describe('time formatting', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads "Last read" from the directory sync, not the probe', () => {
    expect(lastReadAt({ lastSyncAt: '2026-09-17T09:00:00.000Z' })).toBe('2026-09-17T09:00:00.000Z');
    expect(lastReadAt({ lastSyncAt: null })).toBeNull();
  });

  it('formats a fresh read relatively, an old one as a date, and no read as the empty mark', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-17T10:00:00.000Z'));
    const now = new Date();
    expect(formatLastRead(new Date(now.getTime() - 41 * 60_000).toISOString(), now)).toBe('41m ago');
    const old = formatLastRead('2016-10-10T08:12:00.000Z', now);
    expect(old).not.toContain('ago');
    expect(old).toBe(formatDate(new Date('2016-10-10T08:12:00.000Z')));
    expect(formatLastRead(null, now)).toBe(EMPTY_VALUE);
    expect(formatLastRead('not a date', now)).toBe(EMPTY_VALUE);
  });

  it('splits the connected instant into a date and a time with seconds', () => {
    const parts = formatConnectedAt('2024-11-12T09:43:00');
    expect(parts?.date).toMatch(/24/);
    expect(parts?.time).toMatch(/43:00/);
    expect(formatConnectedAt(null)).toBeNull();
    expect(formatConnectedAt('garbage')).toBeNull();
  });
});

describe('usersCountLabel', () => {
  it('pluralises and renders the empty mark before the first read', () => {
    expect(usersCountLabel(null)).toBe(EMPTY_VALUE);
    expect(usersCountLabel(undefined)).toBe(EMPTY_VALUE);
    expect(usersCountLabel(0)).toBe('0 Users');
    expect(usersCountLabel(1)).toBe('1 User');
    expect(usersCountLabel(227)).toBe('227 Users');
  });
});

describe('consentAlert', () => {
  const attempt = (outcome: string, extra: { deniedTiers?: string[]; hasIssues?: boolean } = {}) => ({
    outcome,
    deniedTiers: extra.deniedTiers ?? [],
    hasIssues: extra.hasIssues ?? false,
  });
  const NOT_CONNECTED = "Tenant is still not connected. Data aren't available yet.";

  it('keeps the generic sentence for an unreadable tenant with no attempt on record', () => {
    expect(consentAlert(null, { readable: false, domain: 'acme.com' })).toEqual({
      variant: 'warning',
      message: NOT_CONNECTED,
    });
    expect(consentAlert(undefined, { readable: true, domain: 'acme.com' })).toBeNull();
  });

  it('says nothing for a clean CONNECTED on a readable tenant', () => {
    expect(consentAlert(attempt(DirectoryConsentOutcome.CONNECTED), { readable: true, domain: 'acme.com' })).toBeNull();
  });

  it('falls back to the generic sentence when CONNECTED is on record but the tenant is unreadable', () => {
    expect(
      consentAlert(attempt(DirectoryConsentOutcome.CONNECTED), { readable: false, domain: 'acme.com' })?.message,
    ).toBe(NOT_CONNECTED);
  });

  it('warns about a CONNECTED whose permissions are still settling', () => {
    const alert = consentAlert(attempt(DirectoryConsentOutcome.CONNECTED, { hasIssues: true }), {
      readable: true,
      domain: 'acme.com',
    });
    expect(alert?.variant).toBe('warning');
    expect(alert?.message).not.toBe(NOT_CONNECTED);
  });

  it('names the declined tiers of a PARTIAL', () => {
    const alert = consentAlert(attempt(DirectoryConsentOutcome.PARTIAL, { deniedTiers: ['AUDIT', 'WRITE'] }), {
      readable: true,
      domain: 'acme.com',
    });
    expect(alert?.variant).toBe('warning');
    expect(alert?.message).toContain('declined some permissions: AUDIT, WRITE.');
  });

  it('leaves a PARTIAL with nothing declined to its issues', () => {
    const alert = consentAlert(attempt(DirectoryConsentOutcome.PARTIAL, { hasIssues: true }), {
      readable: true,
      domain: 'acme.com',
    });
    expect(alert?.variant).toBe('warning');
    expect(alert?.message).not.toContain('declined');
  });

  it('gives every failed outcome its own error sentence, readable or not', () => {
    const failed = Object.values(DirectoryConsentOutcome).filter(
      outcome => outcome !== DirectoryConsentOutcome.CONNECTED && outcome !== DirectoryConsentOutcome.PARTIAL,
    );
    const messages = new Set<string>();
    for (const outcome of failed) {
      for (const readable of [true, false]) {
        const alert = consentAlert(attempt(outcome), { readable, domain: 'acme.com' });
        expect(alert?.variant, outcome).toBe('error');
        expect(alert?.message, outcome).not.toBe(NOT_CONNECTED);
        messages.add(alert?.message ?? '');
      }
    }
    expect(messages.size).toBe(failed.length);
  });

  it('names the domain the admin should have signed in to', () => {
    const wrongTenant = attempt(DirectoryConsentOutcome.WRONG_TENANT);
    expect(consentAlert(wrongTenant, { readable: false, domain: 'acme.com' })?.message).toBe(
      'The admin signed in to a different Microsoft 365 organization. Use Reconnect and sign in with an admin account from acme.com.',
    );
    expect(consentAlert(wrongTenant, { readable: false, domain: null })?.message).toContain(
      "an admin account from the customer's domain.",
    );
  });

  it('reads an outcome newer than this build as no outcome', () => {
    expect(consentAlert(attempt('SOMETHING_NEW'), { readable: false, domain: 'acme.com' })?.message).toBe(
      NOT_CONNECTED,
    );
    expect(consentAlert(attempt('SOMETHING_NEW'), { readable: true, domain: 'acme.com' })).toBeNull();
  });
});

describe('consent issues', () => {
  it('tags a provider error with the provider that failed and a pending grant in grey', () => {
    expect(consentIssueTag(DirectoryConsentIssueKind.PROVIDER_ERROR, DirectoryProvider.MICROSOFT_365)).toEqual({
      label: 'Microsoft 365 error',
      variant: 'error',
    });
    expect(consentIssueTag(DirectoryConsentIssueKind.PROVIDER_ERROR, DirectoryProvider.GOOGLE_WORKSPACE).label).toBe(
      'Google Workspace error',
    );
    expect(consentIssueTag(DirectoryConsentIssueKind.PERMISSIONS_PENDING, DirectoryProvider.MICROSOFT_365)).toEqual({
      label: 'Pending',
      variant: 'grey',
    });
    expect(consentIssueTag('SOMETHING_NEW', DirectoryProvider.MICROSOFT_365)).toEqual({
      label: 'SOMETHING_NEW',
      variant: 'grey',
    });
  });

  it("drops the backend's 'unknown' code", () => {
    expect(consentIssueCode('AADSTS650051')).toBe('AADSTS650051');
    expect(consentIssueCode('unknown')).toBeNull();
    expect(consentIssueCode(null)).toBeNull();
  });

  it("links AADSTS codes to Microsoft's lookup and nothing else", () => {
    expect(providerErrorLookupUrl('AADSTS650051')).toBe('https://login.microsoftonline.com/error?code=650051');
    expect(providerErrorLookupUrl('admin_policy_enforced')).toBeNull();
    expect(providerErrorLookupUrl(null)).toBeNull();
  });

  it('copies the details as labelled lines, skipping what is absent', () => {
    const report = consentIssueReport({
      provider: DirectoryProvider.MICROSOFT_365,
      domain: 'matrixfootwear.com',
      occurredAt: '2026-09-30T14:40:22Z',
      tier: 'WRITE',
      code: 'AADSTS650051',
      correlationId: '2cd4b33f-9343-476f-b953-503937072497',
      message: 'Microsoft could not register the app.',
    });
    expect(report).toBe(
      [
        'Provider: Microsoft 365',
        'Domain: matrixfootwear.com',
        'Tier: WRITE',
        'Error code: AADSTS650051',
        'Correlation ID: 2cd4b33f-9343-476f-b953-503937072497',
        'Time (UTC): 2026-09-30T14:40:22Z',
        'Message: Microsoft could not register the app.',
      ].join('\n'),
    );
    expect(
      consentIssueReport({
        provider: DirectoryProvider.GOOGLE_WORKSPACE,
        domain: 'acme.com',
        occurredAt: null,
        tier: null,
        code: 'admin_policy_enforced',
        correlationId: null,
        message: 'Blocked.',
      }),
    ).toBe('Provider: Google Workspace\nDomain: acme.com\nError code: admin_policy_enforced\nMessage: Blocked.');
  });
});
