import { describe, expect, it } from 'vitest';
import { getPrNamespaceIssue } from './auth-error-codes';

/**
 * Pins the seam between the SaaS backend error codes and the signup form. The
 * two PR-namespace failures must map to distinct issues so the form can say
 * plainly what is wrong — namespace missing (404) versus not READY (409) — and
 * every other response must map to nothing so the normal toast path still runs.
 */
describe('getPrNamespaceIssue', () => {
  it('maps PR_NAMESPACE_NOT_FOUND to "missing"', () => {
    expect(getPrNamespaceIssue({ status: 404, data: { code: 'PR_NAMESPACE_NOT_FOUND' } })).toBe('missing');
  });

  it('maps PR_NAMESPACE_UNAVAILABLE to "not-ready"', () => {
    expect(getPrNamespaceIssue({ status: 409, data: { code: 'PR_NAMESPACE_UNAVAILABLE' } })).toBe('not-ready');
  });

  it('returns undefined for other error codes', () => {
    expect(getPrNamespaceIssue({ status: 409, data: { code: 'TENANT_REGISTRATION_BLOCKED' } })).toBeUndefined();
  });

  it('returns undefined when the body has no code', () => {
    expect(getPrNamespaceIssue({ status: 500, data: undefined })).toBeUndefined();
  });
});
