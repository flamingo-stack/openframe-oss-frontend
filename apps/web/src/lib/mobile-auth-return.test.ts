import { describe, expect, it } from 'vitest';
import { authApiClient } from './auth-api-client';
import { MOBILE_AUTH_ERROR, mobileAuthErrorMessage, readMobileAuthReturn } from './mobile-auth-return';

const params = (query: string) => new URLSearchParams(query);

describe('readMobileAuthReturn', () => {
  it('returns the return address verbatim when the server marked the page as a mobile flow', () => {
    expect(readMobileAuthReturn(params('authMobile=true&redirectTo=com.openframe.app%3A%2F%2Fauth'))).toBe(
      'com.openframe.app://auth',
    );
  });

  it('is null for a web flow, with or without a redirectTo', () => {
    expect(readMobileAuthReturn(params(''))).toBeNull();
    expect(readMobileAuthReturn(params('redirectTo=com.openframe.app%3A%2F%2Fauth'))).toBeNull();
    expect(readMobileAuthReturn(params('authMobile=false&redirectTo=com.openframe.app%3A%2F%2Fauth'))).toBeNull();
  });

  it('is null when the flow is mobile but no return address came with it', () => {
    expect(readMobileAuthReturn(params('authMobile=true'))).toBeNull();
    expect(readMobileAuthReturn(params('authMobile=true&redirectTo='))).toBeNull();
    expect(readMobileAuthReturn(params('authMobile=true&redirectTo=%20'))).toBeNull();
  });

  it('does not judge the address itself: the BFF allow-list does', () => {
    expect(readMobileAuthReturn(params('authMobile=true&redirectTo=https%3A%2F%2Fexample.com%2Fauth'))).toBe(
      'https://example.com/auth',
    );
  });
});

describe('ssoJoinReturnUrl', () => {
  it('routes the exit through the BFF with the address and the reason, both encoded', () => {
    const url = authApiClient.ssoJoinReturnUrl('com.openframe.app://auth', MOBILE_AUTH_ERROR.USER_CANCELED);
    expect(url.endsWith('/oauth/join-return?redirectTo=com.openframe.app%3A%2F%2Fauth&reason=USER_CANCELED')).toBe(
      true,
    );
  });

  it('never navigates to the address directly', () => {
    const url = authApiClient.ssoJoinReturnUrl('com.openframe.app://auth', MOBILE_AUTH_ERROR.SESSION_EXPIRED);
    expect(url.startsWith('com.openframe.app://')).toBe(false);
    expect(url).toContain('/oauth/join-return?');
    expect(url).toContain('reason=SESSION_EXPIRED');
  });
});

describe('mobileAuthErrorMessage', () => {
  it('passes the cancel code through verbatim so the quiet-cancel check still matches', () => {
    expect(mobileAuthErrorMessage('USER_CANCELED')).toBe('USER_CANCELED');
  });

  it('has copy for an expired session and a fallback for unknown codes', () => {
    expect(mobileAuthErrorMessage('SESSION_EXPIRED')).toMatch(/expired/);
    expect(mobileAuthErrorMessage('SOMETHING_ELSE')).toContain('SOMETHING_ELSE');
  });
});
