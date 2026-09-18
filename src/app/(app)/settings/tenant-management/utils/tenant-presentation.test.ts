// Pins the enum → label/variant/copy decisions the screens render from. The
// tables are declared exhaustively over the local enum mirrors; these tests make
// sure every value has a non-empty answer and that unknown values (a backend
// ahead of the SDL) degrade to a neutral rendering instead of a crash.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate } from '@/lib/format-date';
import { DirectoryAccessState, DirectoryCapability, DirectoryProvider } from '../types/directory-enums';
import type { TenantAccess } from '../types/tenant-connection';
import {
  accessStateTag,
  capabilityLabels,
  checkResultTag,
  EMPTY_VALUE,
  formatConnectedAt,
  formatLastRead,
  isReadable,
  lastReadAt,
  PROVIDER_ORDER,
  providerPresentation,
  usersCountLabel,
} from './tenant-presentation';

const access = (state: DirectoryAccessState): TenantAccess => ({
  state,
  reason: null,
  checkedAt: '2026-09-17T10:00:00.000Z',
  capabilities: [],
});

describe('accessStateTag', () => {
  it('gives every access state a label and a variant', () => {
    for (const state of Object.values(DirectoryAccessState)) {
      const tag = accessStateTag(state);
      expect(tag.label, state).not.toBe('');
      expect(tag.variant, state).toBeTruthy();
    }
  });

  it('uses the colours of the Figma list', () => {
    expect(accessStateTag('DISCONNECTED').variant).toBe('error');
    expect(accessStateTag('CONSENT_REVOKED').variant).toBe('error');
    expect(accessStateTag('READ_ONLY').variant).toBe('grey');
    expect(accessStateTag('WRITE_AVAILABLE').variant).toBe('outline');
    expect(accessStateTag('WRITE_ENABLED').variant).toBe('success');
  });

  it('renders NOT_AUTHORISED as an error tag (no Figma frame)', () => {
    expect(accessStateTag('NOT_AUTHORISED')).toEqual({ label: 'Not authorised', variant: 'error' });
  });

  it('degrades an unknown value to its raw name in grey, and nothing to "-"', () => {
    expect(accessStateTag('SOMETHING_NEW')).toEqual({ label: 'SOMETHING_NEW', variant: 'grey' });
    expect(accessStateTag(null)).toEqual({ label: EMPTY_VALUE, variant: 'grey' });
    expect(accessStateTag(undefined)).toEqual({ label: EMPTY_VALUE, variant: 'grey' });
  });
});

describe('isReadable / checkResultTag', () => {
  it('treats the three states above DISCONNECTED as a live read', () => {
    expect(isReadable('READ_ONLY')).toBe(true);
    expect(isReadable('WRITE_AVAILABLE')).toBe(true);
    expect(isReadable('WRITE_ENABLED')).toBe(true);
    expect(isReadable('DISCONNECTED')).toBe(false);
    expect(isReadable('NOT_AUTHORISED')).toBe(false);
    expect(isReadable('CONSENT_REVOKED')).toBe(false);
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
    expect(providerPresentation('MICROSOFT_365').label).toBe('Microsoft 365');
    expect(providerPresentation('GOOGLE_WORKSPACE').label).toBe('Google Workspace');
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

  it('formats a fresh read relatively, an old one as a date, and no read as "-"', () => {
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
  it('pluralises and renders "-" before the first read', () => {
    expect(usersCountLabel(null)).toBe(EMPTY_VALUE);
    expect(usersCountLabel(undefined)).toBe(EMPTY_VALUE);
    expect(usersCountLabel(0)).toBe('0 Users');
    expect(usersCountLabel(1)).toBe('1 User');
    expect(usersCountLabel(227)).toBe('227 Users');
  });
});
