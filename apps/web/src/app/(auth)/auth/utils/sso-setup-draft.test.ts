import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  saveSsoSetupDraft,
  SSO_SETUP_DRAFT_KEY,
  SSO_SETUP_DRAFT_MAX_AGE_MS,
  takeSsoSetupDraft,
} from '@/app/(auth)/auth/utils/sso-setup-draft';

const values = { tenantName: 'Acme', tenantDomain: 'acme.openframe.ai' };

afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});

describe('sso setup draft', () => {
  it('gives the details back to the same address, once', () => {
    saveSsoSetupDraft('admin@example.com', values);
    expect(takeSsoSetupDraft('admin@example.com')).toEqual(values);
    expect(takeSsoSetupDraft('admin@example.com')).toBeNull();
  });

  it('drops a draft saved for another address', () => {
    saveSsoSetupDraft('admin@example.com', values);
    expect(takeSsoSetupDraft('other@example.com')).toBeNull();
    expect(sessionStorage.getItem(SSO_SETUP_DRAFT_KEY)).toBeNull();
  });

  it('drops a draft older than its maximum age', () => {
    vi.useFakeTimers();
    saveSsoSetupDraft('admin@example.com', values);
    vi.advanceTimersByTime(SSO_SETUP_DRAFT_MAX_AGE_MS + 1);
    expect(takeSsoSetupDraft('admin@example.com')).toBeNull();
  });

  it('drops a draft it cannot read', () => {
    sessionStorage.setItem(SSO_SETUP_DRAFT_KEY, '{not json');
    expect(takeSsoSetupDraft('admin@example.com')).toBeNull();
  });
});
